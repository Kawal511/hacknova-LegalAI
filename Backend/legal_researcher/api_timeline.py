"""
Evidence Timeline API Router
=============================
Provides endpoints for managing evidence timeline events per case.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import os
import sys

_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from database_manager import DatabaseRouter, get_db_router
from jwt_auth import get_user_id_flexible

router = APIRouter(prefix="/legal", tags=["Timeline"])


# ====================== MODELS ======================

class TimelineEventResponse(BaseModel):
    id: int
    case_id: int
    title: str
    description: str
    event_date: str
    evidence_type: str
    source_file: str
    annotation: str


class AnnotateRequest(BaseModel):
    annotation: str = Field(..., min_length=0)


class CreateTimelineEventRequest(BaseModel):
    case_id: int
    title: str = Field(..., min_length=1)
    description: str = ""
    event_date: str = Field(..., description="ISO date string e.g. 2024-01-15")
    evidence_type: str = Field(default="document", description="document | image | video | witness")
    source_file: str = ""


# ====================== ENDPOINTS ======================

@router.get("/evidence/timeline/{case_id}", response_model=List[TimelineEventResponse])
async def get_timeline_events(
    case_id: int,
    user_id: int = Depends(get_user_id_flexible)
):
    """
    Get all timeline events for a case, sorted by event_date ASC.
    """
    db = get_db_router()

    # Verify case exists
    case = db.get_case(user_id, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or access denied")

    events = db.get_timeline_events(user_id, case_id)
    return [
        TimelineEventResponse(
            id=e["doc_id"],
            case_id=e["case_id"],
            title=e["event_title"] or e["filename"] or "Untitled",
            description=e["parsed_text"][:500] if e["parsed_text"] else "",
            event_date=e["event_date"] or e["uploaded_at"] or "",
            evidence_type=e["evidence_type"] or "document",
            source_file=e["filename"] or "",
            annotation=e["annotation"] or ""
        )
        for e in events
    ]


@router.patch("/evidence/timeline/{event_id}/annotate", response_model=TimelineEventResponse)
async def annotate_event(
    event_id: int,
    body: AnnotateRequest,
    user_id: int = Depends(get_user_id_flexible)
):
    """
    Update the annotation on a timeline event.
    """
    db = get_db_router()

    # Update annotation
    success = db.update_event_annotation(user_id, event_id, body.annotation)
    if not success:
        raise HTTPException(status_code=404, detail="Event not found")

    # Log audit
    db.log_audit(
        user_id=user_id,
        action="ANNOTATE_EVIDENCE",
        resource_type="document",
        resource_id=event_id,
        details=f"Annotation updated: {body.annotation[:100]}"
    )

    # Return updated event
    event = db.get_timeline_event_by_id(user_id, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found after update")

    return TimelineEventResponse(
        id=event["doc_id"],
        case_id=event["case_id"],
        title=event["event_title"] or event["filename"] or "Untitled",
        description=event["parsed_text"][:500] if event["parsed_text"] else "",
        event_date=event["event_date"] or event["uploaded_at"] or "",
        evidence_type=event["evidence_type"] or "document",
        source_file=event["filename"] or "",
        annotation=event["annotation"] or ""
    )


@router.post("/evidence/timeline/event", response_model=TimelineEventResponse)
async def create_timeline_event(
    body: CreateTimelineEventRequest,
    user_id: int = Depends(get_user_id_flexible)
):
    """
    Create a new manual timeline event.
    """
    db = get_db_router()

    # Verify case exists
    case = db.get_case(user_id, body.case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or access denied")

    doc_id = db.create_timeline_event(
        user_id=user_id,
        case_id=body.case_id,
        title=body.title,
        description=body.description,
        event_date=body.event_date,
        evidence_type=body.evidence_type,
        source_file=body.source_file
    )

    # Log audit
    db.log_audit(
        user_id=user_id,
        action="CREATE_TIMELINE_EVENT",
        resource_type="document",
        resource_id=doc_id,
        details=f"Created timeline event: {body.title}"
    )

    return TimelineEventResponse(
        id=doc_id,
        case_id=body.case_id,
        title=body.title,
        description=body.description,
        event_date=body.event_date,
        evidence_type=body.evidence_type,
        source_file=body.source_file,
        annotation=""
    )
