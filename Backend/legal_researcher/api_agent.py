import asyncio
import json
import os
import uuid
from datetime import datetime
from time import perf_counter
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from langchain_core.messages import HumanMessage

from agent.google_auth import credentials_to_dict, get_oauth_flow
from agent.nyaya_agent import AgentState, build_agent_graph
from case_composer import compose_agent_formatted_cases
from database_manager import DatabaseRouter
from jwt_auth import get_user_id_flexible


router = APIRouter(prefix="/legal/agent", tags=["Agent"])
graph = build_agent_graph()
AGENT_RECURSION_LIMIT = int(os.getenv("AGENT_RECURSION_LIMIT", "12"))
AGENT_TIMEOUT_SECONDS = int(os.getenv("AGENT_TIMEOUT_SECONDS", "60"))
AGENT_MAX_STEPS = int(os.getenv("AGENT_MAX_STEPS", "8"))
AGENT_MAX_TOOL_HOPS = int(os.getenv("AGENT_MAX_TOOL_HOPS", "3"))
GOOGLE_REDIRECT_URI_DEFAULT = "http://localhost:8000/legal/agent/auth/google/callback"


def _utc_now_iso() -> str:
    return datetime.utcnow().isoformat()


def _serialize_messages(messages):
    serialized = []
    for msg in messages or []:
        serialized.append(
            {
                "type": msg.__class__.__name__,
                "content": msg.content,
            }
        )
    return serialized


def _load_agent_context(user_id: int):
    db = DatabaseRouter()

    with db.get_tenant_conn(user_id) as conn:
        creds_row = conn.execute(
            "SELECT credentials_json FROM google_credentials WHERE user_id = ?",
            (user_id,),
        ).fetchone()

    with db.get_master_conn() as conn:
        user_row = conn.execute(
            "SELECT email FROM users WHERE user_id = ?",
            (user_id,),
        ).fetchone()

    google_creds = {}
    if creds_row and creds_row["credentials_json"]:
        try:
            google_creds = json.loads(creds_row["credentials_json"])
        except Exception:
            google_creds = {}

    lawyer_email = user_row["email"] if user_row else None
    return google_creds, lawyer_email


def _build_initial_state(run_id: str, case_id: int, user_id: int, message_text: str, google_creds: dict, lawyer_email: str | None) -> AgentState:
    return {
        "messages": [HumanMessage(content=message_text)],
        "execution_logs": [
            {
                "ts": datetime.utcnow().isoformat() + "Z",
                "level": "info",
                "stage": "run",
                "message": "Run queued.",
            }
        ],
        "case_id": case_id,
        "user_id": user_id,
        "case_context": "",
        "research_results": [],
        "verification_passed": False,
        "email_sent": False,
        "calendar_event_id": "",
        "lawyer_email": lawyer_email,
        "google_creds": google_creds,
        "run_id": run_id,
        "step_count": 0,
        "max_steps": AGENT_MAX_STEPS,
        "tool_hops": 0,
        "max_tool_hops": AGENT_MAX_TOOL_HOPS,
        "stop_reason": "",
        "status": "running",
        "duration_ms": 0,
    }


def _persist_run_state(user_id: int, run_id: str, case_id: int, state: Dict[str, Any], *, insert_if_missing: bool = False):
    db = DatabaseRouter()
    persist_state = dict(state)
    persist_state.pop("google_creds", None)
    persist_state["messages"] = _serialize_messages(persist_state.get("messages", []))

    now = _utc_now_iso()
    with db.get_tenant_conn(user_id) as conn:
        if insert_if_missing:
            conn.execute(
                """
                INSERT INTO agent_state (run_id, case_id, user_id, state_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    case_id,
                    user_id,
                    json.dumps(persist_state, ensure_ascii=False),
                    now,
                    now,
                ),
            )
        else:
            conn.execute(
                """
                UPDATE agent_state
                SET state_json = ?, updated_at = ?
                WHERE run_id = ? AND user_id = ?
                """,
                (
                    json.dumps(persist_state, ensure_ascii=False),
                    now,
                    run_id,
                    user_id,
                ),
            )
        conn.commit()


def _compute_stop_reason(step_count: int, tool_hops: int, stop_reason: str) -> str:
    if stop_reason:
        return stop_reason
    if step_count >= AGENT_MAX_STEPS:
        return "max_steps_reached"
    if tool_hops >= AGENT_MAX_TOOL_HOPS:
        return "max_tool_hops_reached"
    return "completed"


def _build_run_response(case_id: int, user_id: int, run_id: str, state: Dict[str, Any]):
    messages = state.get("messages", [])
    last_message = ""
    if messages:
        last = messages[-1]
        if isinstance(last, dict):
            last_message = last.get("content", "")
        else:
            last_message = getattr(last, "content", "")
    step_count = int(state.get("step_count", 0))
    tool_hops = int(state.get("tool_hops", 0))
    stop_reason = _compute_stop_reason(step_count, tool_hops, state.get("stop_reason", ""))
    duration_ms = int(state.get("duration_ms", 0))
    formatted_cases = state.get("formatted_cases")
    if not isinstance(formatted_cases, list) or not formatted_cases:
        formatted_cases = compose_agent_formatted_cases(state, fallback_message=last_message)
    return {
        "run_id": run_id,
        "case_id": case_id,
        "user_id": user_id,
        "verification_passed": bool(state.get("verification_passed", False)),
        "email_sent": bool(state.get("email_sent", False)),
        "calendar_event_id": state.get("calendar_event_id", ""),
        "research_results_count": len(state.get("research_results", [])),
        "last_message": last_message,
        "step_count": step_count,
        "tool_hops": tool_hops,
        "stop_reason": stop_reason,
        "duration_ms": duration_ms,
        "logs": state.get("execution_logs", []) or [],
        "formatted_cases": formatted_cases,
    }


def _attach_formatted_cases(state: Dict[str, Any]):
    messages = state.get("messages", [])
    last_message = ""
    if messages:
        last = messages[-1]
        if isinstance(last, dict):
            last_message = last.get("content", "")
        else:
            last_message = getattr(last, "content", "")
    state["formatted_cases"] = compose_agent_formatted_cases(state, fallback_message=last_message)


def _merge_stream_update(current_state: Dict[str, Any], update: Dict[str, Any]):
    for key, value in update.items():
        if key == "messages":
            current_state["messages"] = (current_state.get("messages", []) or []) + (value or [])
        elif key == "execution_logs":
            current_state["execution_logs"] = (current_state.get("execution_logs", []) or []) + (value or [])
        else:
            current_state[key] = value


async def _run_agent_streaming(case_id: int, user_id: int, run_id: str, initial_state: AgentState):
    start_t = perf_counter()
    current_state: Dict[str, Any] = dict(initial_state)

    current_state["execution_logs"] = (current_state.get("execution_logs", []) or []) + [
        {
            "ts": datetime.utcnow().isoformat() + "Z",
            "level": "info",
            "stage": "run",
            "message": "Run started.",
        }
    ]
    _persist_run_state(user_id, run_id, case_id, current_state)

    try:
        async def _stream_updates():
            async for event in graph.astream(initial_state, config={"recursion_limit": AGENT_RECURSION_LIMIT}, stream_mode="updates"):
                if not isinstance(event, dict):
                    continue
                for _node_name, update in event.items():
                    if isinstance(update, dict):
                        _merge_stream_update(current_state, update)
                current_state["status"] = "running"
                _persist_run_state(user_id, run_id, case_id, current_state)

        await asyncio.wait_for(_stream_updates(), timeout=AGENT_TIMEOUT_SECONDS)
        duration_ms = int((perf_counter() - start_t) * 1000)
        current_state["duration_ms"] = duration_ms
        current_state["status"] = "completed"
        step_count = int(current_state.get("step_count", 0))
        tool_hops = int(current_state.get("tool_hops", 0))
        current_state["stop_reason"] = _compute_stop_reason(step_count, tool_hops, current_state.get("stop_reason", ""))
        current_state["execution_logs"] = (current_state.get("execution_logs", []) or []) + [
            {
                "ts": datetime.utcnow().isoformat() + "Z",
                "level": "info",
                "stage": "run",
                "message": f"Run finished in {duration_ms}ms with stop_reason={current_state['stop_reason']}.",
            }
        ]
        _attach_formatted_cases(current_state)
        _persist_run_state(user_id, run_id, case_id, current_state)
    except asyncio.TimeoutError:
        duration_ms = int((perf_counter() - start_t) * 1000)
        current_state["duration_ms"] = duration_ms
        current_state["status"] = "failed"
        current_state["stop_reason"] = "timeout"
        current_state["execution_logs"] = (current_state.get("execution_logs", []) or []) + [
            {
                "ts": datetime.utcnow().isoformat() + "Z",
                "level": "error",
                "stage": "run",
                "message": f"Agent timed out after {AGENT_TIMEOUT_SECONDS}s.",
            }
        ]
        _attach_formatted_cases(current_state)
        _persist_run_state(user_id, run_id, case_id, current_state)
    except Exception as e:
        error_message = str(e) or "Agent execution failed"
        duration_ms = int((perf_counter() - start_t) * 1000)
        status_code = "failed"
        stop_reason = "error"
        if "GRAPH_RECURSION_LIMIT" in error_message or "recursion limit" in error_message.lower():
            stop_reason = "recursion_limit"
        elif "rate_limit" in error_message.lower() or "rate limit" in error_message.lower():
            stop_reason = "rate_limit"
        current_state["duration_ms"] = duration_ms
        current_state["status"] = status_code
        current_state["stop_reason"] = stop_reason
        current_state["execution_logs"] = (current_state.get("execution_logs", []) or []) + [
            {
                "ts": datetime.utcnow().isoformat() + "Z",
                "level": "error",
                "stage": "run",
                "message": error_message,
            }
        ]
        _attach_formatted_cases(current_state)
        _persist_run_state(user_id, run_id, case_id, current_state)


@router.post("/run/{case_id}")
async def run_agent(case_id: int, payload: dict, user_id: int = Depends(get_user_id_flexible)):
    google_creds, lawyer_email = _load_agent_context(user_id)

    run_id = str(uuid.uuid4())
    message_text = payload.get("message", "Review this case and decide next actions.")

    initial_state: AgentState = _build_initial_state(
        run_id,
        case_id,
        user_id,
        message_text,
        google_creds,
        lawyer_email,
    )

    start_t = perf_counter()
    try:
        result = await asyncio.wait_for(
            graph.ainvoke(initial_state, config={"recursion_limit": AGENT_RECURSION_LIMIT}),
            timeout=AGENT_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as e:
        raise HTTPException(
            status_code=504,
            detail=f"Agent timed out after {AGENT_TIMEOUT_SECONDS}s. Try shorter instructions or rerun.",
        ) from e
    except Exception as e:
        error_message = str(e) or "Agent execution failed"
        if "GRAPH_RECURSION_LIMIT" in error_message or "recursion limit" in error_message.lower():
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Agent exceeded graph recursion limit ({AGENT_RECURSION_LIMIT}). "
                    "Please rerun with shorter instructions."
                ),
            ) from e
        if "rate_limit" in error_message.lower() or "rate limit" in error_message.lower():
            raise HTTPException(status_code=429, detail=error_message) from e
        raise HTTPException(status_code=500, detail=error_message) from e
    duration_ms = int((perf_counter() - start_t) * 1000)

    persist_state = dict(result)
    persist_state["status"] = "completed"
    persist_state["duration_ms"] = duration_ms

    execution_logs = persist_state.get("execution_logs", []) or []
    step_count = int(persist_state.get("step_count", 0))
    tool_hops = int(persist_state.get("tool_hops", 0))
    stop_reason = _compute_stop_reason(step_count, tool_hops, persist_state.get("stop_reason", ""))
    persist_state["stop_reason"] = stop_reason

    execution_logs = execution_logs + [
        {
            "ts": datetime.utcnow().isoformat() + "Z",
            "level": "info",
            "stage": "run",
            "message": f"Run finished in {duration_ms}ms with stop_reason={stop_reason}.",
        }
    ]
    persist_state["execution_logs"] = execution_logs
    _attach_formatted_cases(persist_state)
    _persist_run_state(user_id, run_id, case_id, persist_state, insert_if_missing=True)

    return _build_run_response(case_id, user_id, run_id, persist_state)


@router.post("/run_async/{case_id}")
async def run_agent_async(case_id: int, payload: dict, user_id: int = Depends(get_user_id_flexible)):
    google_creds, lawyer_email = _load_agent_context(user_id)
    run_id = str(uuid.uuid4())
    message_text = payload.get("message", "Review this case and decide next actions.")

    initial_state: AgentState = _build_initial_state(
        run_id,
        case_id,
        user_id,
        message_text,
        google_creds,
        lawyer_email,
    )
    _persist_run_state(user_id, run_id, case_id, dict(initial_state), insert_if_missing=True)

    asyncio.create_task(_run_agent_streaming(case_id, user_id, run_id, initial_state))
    return {
        "run_id": run_id,
        "case_id": case_id,
        "user_id": user_id,
        "status": "running",
    }


@router.get("/run_status/{run_id}")
def get_agent_run_status(run_id: str, user_id: int = Depends(get_user_id_flexible)):
    db = DatabaseRouter()
    with db.get_tenant_conn(user_id) as conn:
        row = conn.execute(
            """
            SELECT run_id, case_id, user_id, state_json, created_at, updated_at
            FROM agent_state
            WHERE run_id = ? AND user_id = ?
            LIMIT 1
            """,
            (run_id, user_id),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Run not found")

    state = json.loads(row["state_json"])
    status = state.get("status", "completed")
    run_payload = _build_run_response(row["case_id"], row["user_id"], row["run_id"], state)
    run_payload["status"] = status
    run_payload["created_at"] = row["created_at"]
    run_payload["updated_at"] = row["updated_at"]
    return run_payload


@router.get("/history/{case_id}")
def get_agent_history(case_id: int, user_id: int = Depends(get_user_id_flexible)):
    db = DatabaseRouter()
    with db.get_tenant_conn(user_id) as conn:
        rows = conn.execute(
            """
            SELECT run_id, case_id, user_id, state_json, created_at, updated_at
            FROM agent_state
            WHERE case_id = ? AND user_id = ?
            ORDER BY created_at DESC
            """,
            (case_id, user_id),
        ).fetchall()

    payload = []
    for row in rows:
        state = json.loads(row["state_json"])
        if not isinstance(state.get("formatted_cases"), list) or not state.get("formatted_cases"):
            state["formatted_cases"] = compose_agent_formatted_cases(state)
        payload.append(
            {
                "run_id": row["run_id"],
                "case_id": row["case_id"],
                "user_id": row["user_id"],
                "state": state,
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
        )
    return payload


@router.get("/auth/google")
def google_auth_start(redirect_uri: str | None = None):
    # Use one canonical redirect URI to avoid redirect_uri_mismatch across environments.
    redirect_uri = (os.getenv("GOOGLE_REDIRECT_URI") or redirect_uri or GOOGLE_REDIRECT_URI_DEFAULT).strip()
    try:
        flow = get_oauth_flow(redirect_uri)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth is not configured. Missing client_secret.json in Backend/legal_researcher.",
        ) from e
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return {"auth_url": auth_url}


@router.get("/auth/google/callback")
def google_auth_callback(
    code: str,
    redirect_uri: str | None = None,
    user_id: int = Depends(get_user_id_flexible),
):
    if not redirect_uri:
        redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", GOOGLE_REDIRECT_URI_DEFAULT)

    try:
        flow = get_oauth_flow(redirect_uri)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth is not configured. Missing client_secret.json in Backend/legal_researcher.",
        ) from e
    flow.fetch_token(code=code)
    creds_dict = credentials_to_dict(flow.credentials)

    db = DatabaseRouter()
    creds_json = json.dumps(creds_dict, ensure_ascii=False)

    with db.get_tenant_conn(user_id) as conn:
        existing = conn.execute(
            "SELECT user_id FROM google_credentials WHERE user_id = ?",
            (user_id,),
        ).fetchone()

        if existing:
            conn.execute(
                "UPDATE google_credentials SET credentials_json = ? WHERE user_id = ?",
                (creds_json, user_id),
            )
        else:
            conn.execute(
                "INSERT INTO google_credentials (user_id, credentials_json) VALUES (?, ?)",
                (user_id, creds_json),
            )
        conn.commit()

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3001")
    return RedirectResponse(url=f"{frontend_url}?google_auth=success")
