import base64
import json
import operator
import os
from datetime import datetime
from email.mime.text import MIMEText
from typing import Annotated, List, TypedDict

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, StateGraph
try:
    from langgraph.prebuilt import ToolNode
except Exception:
    ToolNode = None

from agent.agent_tools import (
    answer_from_case_docs,
    create_calendar_event,
    read_upcoming_events,
    search_legal_precedents,
    send_email_to_lawyer,
    verify_claims,
)
from database_manager import DatabaseRouter
from legal_researcher import LegalResearcher


GROQ_API_KEY = os.getenv("GROQ_API_KEY")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")
AGENT_GROQ_MODEL = os.getenv("AGENT_GROQ_MODEL", "llama-3.1-8b-instant")
AGENT_MAX_STEPS = int(os.getenv("AGENT_MAX_STEPS", "8"))
AGENT_MAX_TOOL_HOPS = int(os.getenv("AGENT_MAX_TOOL_HOPS", "3"))
TOOLS = [
    search_legal_precedents,
    answer_from_case_docs,
    verify_claims,
    send_email_to_lawyer,
    create_calendar_event,
    read_upcoming_events,
]


class AgentLogEntry(TypedDict, total=False):
    ts: str
    level: str
    stage: str
    message: str


class AgentState(TypedDict, total=False):
    messages: Annotated[List[BaseMessage], operator.add]
    execution_logs: Annotated[List[AgentLogEntry], operator.add]
    case_id: int
    user_id: int
    case_context: str
    research_results: list
    verification_passed: bool
    email_sent: bool
    calendar_event_id: str
    lawyer_email: str
    google_creds: dict
    run_id: str
    step_count: int
    max_steps: int
    tool_hops: int
    max_tool_hops: int
    stop_reason: str


def get_llm():
    return ChatGroq(
        model=AGENT_GROQ_MODEL,
        temperature=0.1,
        api_key=GROQ_API_KEY,
    ).bind_tools(TOOLS)


def _get_last_tool_call(state: AgentState):
    messages = state.get("messages", [])
    if not messages:
        return None
    last = messages[-1]
    if isinstance(last, AIMessage) and getattr(last, "tool_calls", None):
        return last.tool_calls[0]
    return None


def _message_text(msg: BaseMessage) -> str:
    content = getattr(msg, "content", "")
    if isinstance(content, str):
        return content
    try:
        return json.dumps(content)
    except Exception:
        return str(content)


def _log(stage: str, message: str, level: str = "info") -> AgentLogEntry:
    return {
        "ts": datetime.utcnow().isoformat() + "Z",
        "level": level,
        "stage": stage,
        "message": message,
    }


def _next_tool_hops(state: AgentState) -> int:
    return int(state.get("tool_hops", 0)) + 1


def context_loader_node(state: AgentState):
    user_id = state.get("user_id")
    case_id = state.get("case_id")

    db = DatabaseRouter()
    case_context_parts = []

    with db.get_tenant_conn(user_id) as conn:
        case_row = conn.execute(
            "SELECT case_id, client_name, raw_description, structured_data FROM cases WHERE case_id = ?",
            (case_id,),
        ).fetchone()

        doc_rows = conn.execute(
            "SELECT filename, parsed_text FROM documents WHERE case_id = ?",
            (case_id,),
        ).fetchall()

    if case_row:
        structured = case_row["structured_data"] if case_row["structured_data"] else "{}"
        case_context_parts.append(f"Case ID: {case_row['case_id']}")
        case_context_parts.append(f"Client: {case_row['client_name'] or 'Unknown'}")
        case_context_parts.append(f"Description: {case_row['raw_description'] or ''}")
        case_context_parts.append(f"Structured Data: {structured}")

    if doc_rows:
        case_context_parts.append("Documents:")
        for row in doc_rows:
            snippet = (row["parsed_text"] or "")[:1500]
            case_context_parts.append(f"- {row['filename'] or 'untitled'}: {snippet}")

    case_context = "\n".join(case_context_parts).strip() or "No context found for this case."
    system_prompt = (
        "You are NyayaZephyr, an agentic legal assistant. "
        "Use tools when needed and keep responses accurate, concise, and grounded in case context."
    )

    return {
        "case_context": case_context,
        "execution_logs": [
            _log("context", "Loaded case context and documents."),
        ],
        "messages": [
            SystemMessage(content=system_prompt),
            SystemMessage(content=f"Case context:\n{case_context}"),
        ],
    }


async def agent_node(state: AgentState):
    next_step = int(state.get("step_count", 0)) + 1
    max_steps = int(state.get("max_steps", AGENT_MAX_STEPS))
    if next_step > max_steps:
        return {
            "step_count": next_step,
            "stop_reason": "max_steps_reached",
            "execution_logs": [
                _log("agent", f"Stopped at step budget ({max_steps}).", "warn"),
            ],
            "messages": [
                SystemMessage(content="Stopping run: reached step budget for this request."),
            ],
        }

    llm = get_llm()
    response = await llm.ainvoke(state.get("messages", []))
    has_tool_call = bool(getattr(response, "tool_calls", None))
    if has_tool_call:
        tool_name = response.tool_calls[0].get("name", "unknown_tool")
        log_msg = f"Model requested tool: {tool_name}"
    else:
        log_msg = "Model returned final response without tool call."
    return {
        "messages": [response],
        "step_count": next_step,
        "execution_logs": [_log("agent", log_msg)],
    }


def researcher_node(state: AgentState):
    tool_call = _get_last_tool_call(state)
    args = tool_call.get("args", {}) if tool_call else {}
    query = args.get("query") or "murder case law India"

    researcher = LegalResearcher(FIRECRAWL_API_KEY, GROQ_API_KEY)
    urls = researcher.find_relevant_cases(query)
    urls = (urls or [])[:2]
    details = researcher.get_case_details(urls)

    research_results = []
    for url, doc in details:
        markdown = getattr(doc, "markdown", "") or ""
        research_results.append(
            {
                "url": url,
                "summary": markdown[:1200],
            }
        )

    return {
        "research_results": research_results,
        "tool_hops": _next_tool_hops(state),
        "execution_logs": [
            _log("research", f"Collected {len(research_results)} legal precedents."),
        ],
        "messages": [
            SystemMessage(
                content=f"Research complete. Retrieved {len(research_results)} precedents for query: {query}"
            )
        ],
    }


async def qa_node(state: AgentState):
    tool_call = _get_last_tool_call(state)
    args = tool_call.get("args", {}) if tool_call else {}
    question = args.get("question", "Summarize key points from this case.")

    prompt = (
        "Answer only from the provided case context and documents.\n"
        f"Question: {question}\n\n"
        f"Case Context:\n{state.get('case_context', '')}"
    )
    llm = ChatGroq(model=AGENT_GROQ_MODEL, temperature=0.1, api_key=GROQ_API_KEY)
    answer = await llm.ainvoke([HumanMessage(content=prompt)])

    return {
        "tool_hops": _next_tool_hops(state),
        "execution_logs": [_log("qa", "Generated answer from case documents.")],
        "messages": [SystemMessage(content=f"Case-doc answer: {_message_text(answer)}")],
    }


async def verifier_node(state: AgentState):
    tool_call = _get_last_tool_call(state)
    args = tool_call.get("args", {}) if tool_call else {}
    claims = args.get("claims", "")

    verify_prompt = (
        "Cross-check the claims against case context. "
        "Return JSON only with keys: verification_passed (bool), rationale (string).\n\n"
        f"Claims:\n{claims}\n\n"
        f"Case Context:\n{state.get('case_context', '')}"
    )
    llm = ChatGroq(model=AGENT_GROQ_MODEL, temperature=0.1, api_key=GROQ_API_KEY)
    result = await llm.ainvoke([HumanMessage(content=verify_prompt)])
    text = _message_text(result)

    verification_passed = False
    try:
        parsed = json.loads(text)
        verification_passed = bool(parsed.get("verification_passed", False))
    except Exception:
        lowered = text.lower()
        verification_passed = "true" in lowered and "false" not in lowered

    return {
        "verification_passed": verification_passed,
        "tool_hops": _next_tool_hops(state),
        "execution_logs": [_log("verify", f"Verification result: {verification_passed}")],
        "messages": [SystemMessage(content=f"Verification result: {text}")],
    }


def email_node(state: AgentState):
    creds_data = state.get("google_creds") or {}
    if not creds_data:
        return {
            "email_sent": False,
            "tool_hops": _next_tool_hops(state),
            "execution_logs": [_log("email", "Skipped email: missing Google credentials.", "warn")],
            "messages": [SystemMessage(content="Email blocked: missing Google credentials.")],
        }

    tool_call = _get_last_tool_call(state)
    args = tool_call.get("args", {}) if tool_call else {}
    subject = args.get("subject", "NyayaZephyr Case Update")
    body = args.get("body", "Please review the latest verified case updates.")
    to_email = state.get("lawyer_email")

    if not to_email:
        return {
            "email_sent": False,
            "tool_hops": _next_tool_hops(state),
            "execution_logs": [_log("email", "Skipped email: missing lawyer email.", "warn")],
            "messages": [SystemMessage(content="Email blocked: missing lawyer email.")],
        }

    try:
        creds = Credentials(**creds_data)
        service = build("gmail", "v1", credentials=creds)

        message = MIMEText(body)
        message["to"] = to_email
        message["subject"] = subject
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()

        service.users().messages().send(userId="me", body={"raw": raw_message}).execute()
        return {
            "email_sent": True,
            "tool_hops": _next_tool_hops(state),
            "execution_logs": [_log("email", f"Email sent to {to_email}.")],
            "messages": [SystemMessage(content=f"Email sent successfully to {to_email}.")],
        }
    except Exception as e:
        return {
            "email_sent": False,
            "tool_hops": _next_tool_hops(state),
            "execution_logs": [_log("email", f"Email send failed: {e}", "error")],
            "messages": [SystemMessage(content=f"Email send failed: {e}")],
        }


def calendar_node(state: AgentState):
    creds_data = state.get("google_creds") or {}
    if not creds_data:
        return {
            "tool_hops": _next_tool_hops(state),
            "execution_logs": [_log("calendar", "Skipped calendar: missing Google credentials.", "warn")],
            "messages": [SystemMessage(content="Calendar action blocked: missing Google credentials.")],
        }

    tool_call = _get_last_tool_call(state)
    if not tool_call:
        return {
            "tool_hops": _next_tool_hops(state),
            "execution_logs": [_log("calendar", "Skipped calendar: no tool call found.", "warn")],
            "messages": [SystemMessage(content="Calendar action skipped: no tool call found.")],
        }

    args = tool_call.get("args", {})

    try:
        creds = Credentials(**creds_data)
        service = build("calendar", "v3", credentials=creds)

        if tool_call.get("name") == "create_calendar_event":
            title = args.get("title", "NyayaZephyr Legal Reminder")
            start_iso = args.get("start_iso")
            end_iso = args.get("end_iso")
            if not start_iso or not end_iso:
                return {
                    "tool_hops": _next_tool_hops(state),
                    "execution_logs": [_log("calendar", "Create event failed: missing start or end.", "warn")],
                    "messages": [SystemMessage(content="Calendar event creation failed: start_iso and end_iso are required.")]
                }

            event = {
                "summary": title,
                "description": "Created by NyayaZephyr",
                "start": {"dateTime": start_iso, "timeZone": "Asia/Kolkata"},
                "end": {"dateTime": end_iso, "timeZone": "Asia/Kolkata"},
            }
            created = service.events().insert(calendarId="primary", body=event).execute()
            event_id = created.get("id", "")
            return {
                "calendar_event_id": event_id,
                "tool_hops": _next_tool_hops(state),
                "execution_logs": [_log("calendar", f"Created calendar event {event_id}.")],
                "messages": [SystemMessage(content=f"Calendar event created: {event_id}")],
            }

        days = int(args.get("days", 7))
        response = service.events().list(
            calendarId="primary",
            maxResults=10,
            singleEvents=True,
            orderBy="startTime",
        ).execute()
        items = response.get("items", [])
        summary = f"Read {len(items)} upcoming events for next {days} days."
        return {
            "tool_hops": _next_tool_hops(state),
            "execution_logs": [_log("calendar", summary)],
            "messages": [SystemMessage(content=summary)],
        }
    except Exception as e:
        return {
            "tool_hops": _next_tool_hops(state),
            "execution_logs": [_log("calendar", f"Calendar action failed: {e}", "error")],
            "messages": [SystemMessage(content=f"Calendar action failed: {e}")],
        }


def route_tool_call(state: AgentState):
    if int(state.get("step_count", 0)) >= int(state.get("max_steps", AGENT_MAX_STEPS)):
        return END

    if int(state.get("tool_hops", 0)) >= int(state.get("max_tool_hops", AGENT_MAX_TOOL_HOPS)):
        return END

    tool_call = _get_last_tool_call(state)
    if not tool_call:
        return END

    name = tool_call.get("name")
    mapping = {
        "search_legal_precedents": "researcher",
        "answer_from_case_docs": "qa",
        "verify_claims": "verifier",
        "send_email_to_lawyer": "email",
        "create_calendar_event": "calendar",
        "read_upcoming_events": "calendar",
    }
    return mapping.get(name, END)


def build_agent_graph():
    graph = StateGraph(AgentState)

    graph.add_node("context_loader", context_loader_node)
    graph.add_node("agent", agent_node)
    graph.add_node("researcher", researcher_node)
    graph.add_node("qa", qa_node)
    graph.add_node("verifier", verifier_node)
    graph.add_node("email", email_node)
    graph.add_node("calendar", calendar_node)

    graph.set_entry_point("context_loader")
    graph.add_edge("context_loader", "agent")

    graph.add_conditional_edges("agent", route_tool_call)
    graph.add_edge("researcher", "agent")
    graph.add_edge("qa", "agent")
    graph.add_edge("verifier", "agent")
    graph.add_edge("email", "agent")
    graph.add_edge("calendar", "agent")

    return graph.compile()
