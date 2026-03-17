from langchain_core.tools import tool


@tool
def search_legal_precedents(query: str) -> str:
    """Search legal precedents relevant to a query."""
    return f"search_legal_precedents stub invoked for query: {query}"


@tool
def answer_from_case_docs(question: str) -> str:
    """Answer a question using case documents."""
    return f"answer_from_case_docs stub invoked for question: {question}"


@tool
def verify_claims(claims: str) -> str:
    """Verify claims against available case context."""
    return f"verify_claims stub invoked for claims: {claims}"


@tool
def send_email_to_lawyer(subject: str, body: str) -> str:
    """Send an email update to the assigned lawyer."""
    return f"send_email_to_lawyer stub invoked with subject: {subject}"


@tool
def create_calendar_event(title: str, start_iso: str, end_iso: str) -> str:
    """Create a calendar event for a legal workflow task."""
    return f"create_calendar_event stub invoked for title: {title}"


@tool
def read_upcoming_events(days: int = 7) -> str:
    """Read upcoming calendar events within a day window."""
    return f"read_upcoming_events stub invoked for next {days} days"
