from __future__ import annotations

import re
from typing import Any, Dict, List


_MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_INLINE_CODE_RE = re.compile(r"`([^`]+)`")
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _clean_plain_text(value: str) -> str:
    text = value.replace("\r\n", "\n").replace("\r", "\n")

    # Normalize emphasis markers early so prefix checks work on wrapped content.
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"__([^_]+)__", r"\1", text)
    text = re.sub(r"_([^_]+)_", r"\1", text)

    # Remove common scraped wrappers/boilerplate from legal document pages.
    boilerplate_starts = [
        "Skip to main content",
        "Legal Document View",
        "Unlock Advanced Research with PRISMAI",
        "Upgrade to Premium",
        "Know your Kanoon",
        "Doc Gen Hub",
        "Counter Argument",
        "Case Predict AI",
        "Talk with IK Doc",
    ]

    filtered_lines: List[str] = []
    for line in text.split("\n"):
        raw = line.strip()
        normalized_raw = raw.lstrip("*_`#>- ")
        if not raw:
            filtered_lines.append("")
            continue
        if any(normalized_raw.startswith(prefix) for prefix in boilerplate_starts):
            continue
        if normalized_raw.startswith("[Cites ") or normalized_raw.startswith("\\[Cites "):
            continue
        filtered_lines.append(line)
    text = "\n".join(filtered_lines)

    # Decode escaped markdown-like sequences.
    text = text.replace("\\\\", " ")
    text = text.replace("\\[", "[").replace("\\]", "]")
    text = text.replace("\\(", "(").replace("\\)", ")")
    text = text.replace("\\-", "-").replace("\\_", "_")
    text = text.replace("\\*", "*").replace("\\#", "#")
    text = text.replace("\\.", ".")

    # Convert links to plain text while preserving visible labels.
    text = _MARKDOWN_LINK_RE.sub(lambda m: m.group(1).strip(), text)
    text = _INLINE_CODE_RE.sub(lambda m: m.group(1).strip(), text)
    text = _HTML_TAG_RE.sub(" ", text)

    # Remove markdown section markers and list tokens.
    normalized_lines: List[str] = []
    for line in text.split("\n"):
        l = line.strip()
        if not l:
            normalized_lines.append("")
            continue
        l = re.sub(r"^#{1,6}\s+", "", l)
        l = re.sub(r"^[-*+]\s+", "", l)
        l = re.sub(r"^>\s*", "", l)
        l = re.sub(r"^\d+[.)]\s+", "", l)
        if l == "```":
            continue
        normalized_lines.append(l)
    text = "\n".join(normalized_lines)

    # Collapse noisy punctuation/spacing while preserving paragraph breaks.
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()
    return text


def _to_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, str):
        text = _clean_plain_text(value)
        return text if text else default
    return _clean_plain_text(str(value))


def _pick_first_non_empty(values: List[Any], default: str = "") -> str:
    for value in values:
        text = _to_text(value, "")
        if text:
            return text
    return default


def _build_key_points(case_data: Dict[str, Any], summary_text: str, judgement_text: str) -> List[str]:
    points: List[str] = []

    parties = case_data.get("parties") or {}
    petitioner = _to_text(parties.get("petitioner"), "") if isinstance(parties, dict) else ""
    respondent = _to_text(parties.get("respondent"), "") if isinstance(parties, dict) else ""
    if petitioner or respondent:
        points.append(f"Parties involved: {petitioner or 'Not specified'} vs {respondent or 'Not specified'}")

    court = _to_text(case_data.get("court"), "")
    date = _to_text(case_data.get("date"), "")
    if court or date:
        points.append(f"Forum and date: {court or 'Unknown court'} on {date or 'Unknown date'}")

    case_type = _to_text(case_data.get("case_type"), "")
    if case_type:
        points.append(f"Proceeding type: {case_type}")

    verdict = _to_text(case_data.get("verdict"), "")
    if verdict and verdict.lower() != "not determined":
        points.append(f"Outcome signal: {verdict}")

    if judgement_text:
        points.append(f"Judgement note: {judgement_text[:180]}{'...' if len(judgement_text) > 180 else ''}")

    if summary_text:
        points.append(f"Summary insight: {summary_text[:180]}{'...' if len(summary_text) > 180 else ''}")

    deduped: List[str] = []
    seen = set()
    for item in points:
        norm = item.strip().lower()
        if norm and norm not in seen:
            deduped.append(item)
            seen.add(norm)
    return deduped[:8]


def compose_case_output(case_data: Dict[str, Any], ai_message: str | None = None, source: str = "research") -> Dict[str, Any]:
    title = _pick_first_non_empty(
        [
            case_data.get("case_title"),
            case_data.get("title"),
            case_data.get("name"),
            "Case Output",
        ],
        "Case Output",
    )

    summary_text = _pick_first_non_empty(
        [
            case_data.get("ai_summary"),
            case_data.get("summary"),
            case_data.get("snippet"),
        ],
        "No summary available.",
    )

    judgement_text = _pick_first_non_empty(
        [
            case_data.get("verdict"),
            case_data.get("judgement"),
            case_data.get("judgment"),
        ],
        "Judgement details not explicitly available.",
    )

    details = [
        f"Title: {title}",
        f"Court: {_to_text(case_data.get('court'), 'Not specified')}",
        f"Date: {_to_text(case_data.get('date'), 'Not specified')}",
        f"Case Type: {_to_text(case_data.get('case_type'), 'Not specified')}",
        f"Reference URL: {_to_text(case_data.get('url'), 'Not available')}",
    ]

    ai_text = _pick_first_non_empty(
        [
            ai_message,
            case_data.get("ai_message"),
            case_data.get("ai_summary"),
            case_data.get("summary"),
        ],
        "No AI message available.",
    )

    other_sections = []
    parties = case_data.get("parties") or {}
    if isinstance(parties, dict) and (parties.get("petitioner") or parties.get("respondent")):
        other_sections.append(
            {
                "title": "Parties",
                "content": f"Petitioner: {_to_text(parties.get('petitioner'), 'Not specified')} | Respondent: {_to_text(parties.get('respondent'), 'Not specified')}",
            }
        )

    relevance_score = case_data.get("relevance_score")
    if relevance_score is not None:
        other_sections.append(
            {
                "title": "Relevance",
                "content": f"Relevance score: {relevance_score}",
            }
        )

    return {
        "title": title,
        "source": source,
        "details": details,
        "judgement": judgement_text,
        "summary": summary_text,
        "key_points": _build_key_points(case_data, summary_text, judgement_text),
        "ai_message": ai_text,
        "other_sections": other_sections,
    }


def compose_agent_formatted_cases(state: Dict[str, Any], fallback_message: str = "") -> List[Dict[str, Any]]:
    formatted_cases: List[Dict[str, Any]] = []

    for idx, item in enumerate(state.get("research_results", []) or []):
        if not isinstance(item, dict):
            continue
        case_data = {
            "case_title": _pick_first_non_empty([item.get("case_title"), item.get("title"), f"Research Case {idx + 1}"], f"Research Case {idx + 1}"),
            "url": item.get("url"),
            "summary": item.get("summary"),
            "ai_summary": item.get("summary"),
            "verdict": item.get("verdict"),
            "court": item.get("court"),
            "date": item.get("date"),
            "case_type": item.get("case_type"),
            "parties": item.get("parties") if isinstance(item.get("parties"), dict) else {},
        }
        formatted_cases.append(compose_case_output(case_data, source="agent_research"))

    if not formatted_cases:
        ai_text = _pick_first_non_empty([fallback_message, state.get("last_message")], "No synthesized message available.")
        formatted_cases.append(
            compose_case_output(
                {
                    "case_title": "Agent Output",
                    "summary": ai_text,
                    "ai_summary": ai_text,
                    "verdict": state.get("stop_reason") or "completed",
                    "case_type": "Agent Run",
                },
                ai_message=ai_text,
                source="agent_output",
            )
        )

    return formatted_cases
