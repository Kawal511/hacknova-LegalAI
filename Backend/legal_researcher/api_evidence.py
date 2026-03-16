"""
Evidence API Endpoints
======================
Provides endpoints for uploading, analyzing, and managing visual evidence.
Uses Google Gemini Vision API for automated analysis.
"""

import os
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, File, UploadFile, Form, Query, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database_manager import get_db_router
from evidence_analyzer import EvidenceAnalyzer, DEPS_AVAILABLE

# Router
router = APIRouter(prefix="/legal/evidence", tags=["Evidence Analysis"])

# Evidence storage directory
EVIDENCE_DIR = Path("evidence_files")
EVIDENCE_DIR.mkdir(exist_ok=True)

# Initialize analyzer (may fail if deps not installed)
analyzer = None
if DEPS_AVAILABLE:
    try:
        analyzer = EvidenceAnalyzer()
    except Exception as e:
        print(f"Warning: Evidence analyzer not available: {e}")


# ====================== RESPONSE MODELS ======================

class EvidenceUploadResponse(BaseModel):
    success: bool
    evidence_id: Optional[int] = None
    message: str
    analysis: Optional[dict] = None
    is_nsfw: bool = False
    content_warning: Optional[str] = None


class EvidenceItem(BaseModel):
    evidence_id: int
    case_id: int
    file_type: str
    original_filename: str
    file_size: int
    uploaded_at: str
    is_nsfw: bool = False
    content_warning: Optional[str] = None
    analysis: Optional[dict] = None


class CaseEvidenceResponse(BaseModel):
    case_id: int
    evidence_items: list
    total: int


# ====================== UPLOAD ENDPOINTS ======================

@router.post("/analyze-image", response_model=EvidenceUploadResponse)
async def upload_and_analyze_image(
    file: UploadFile = File(...),
    case_id: int = Form(...),
    case_type: str = Form("general"),
    description: str = Form(""),
    user_id: int = Form(...)
):
    """
    Upload and analyze an image for evidence.
    
    - Supports JPG, PNG, GIF, WebP
    - Max size: 10MB
    - Uses Gemini Vision for object detection, OCR, key findings
    - Flags NSFW content for blur
    """
    if not analyzer:
        raise HTTPException(
            status_code=503, 
            detail="Evidence analyzer not available. Install dependencies: pip install -r requirements_evidence.txt"
        )
    
    # Validate file type
    allowed_types = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )
    
    # Validate file size (10MB)
    contents = await file.read()
    file_size = len(contents)
    if file_size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")
    
    # Create user evidence directory
    user_dir = EVIDENCE_DIR / f"user_{user_id}"
    user_dir.mkdir(exist_ok=True)
    
    # Save file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"evidence_{case_id}_{timestamp}{ext}"
    file_path = user_dir / safe_filename
    
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Analyze image
    try:
        result = analyzer.analyze_image(
            image_path=str(file_path),
            case_type=case_type,
            description=description
        )
        
        if not result["success"]:
            # Still save the evidence even if analysis fails
            db = get_db_router()
            evidence_id = db.save_evidence(
                user_id=user_id,
                case_id=case_id,
                file_type="image",
                file_path=str(file_path),
                original_filename=file.filename,
                file_size=file_size
            )
            
            return EvidenceUploadResponse(
                success=True,
                evidence_id=evidence_id,
                message=f"Image saved but analysis failed: {result.get('error', 'Unknown error')}",
                is_nsfw=False
            )
        
        # Extract safety flags
        analysis = result.get("analysis", {})
        safety = analysis.get("safety_assessment", {})
        is_nsfw = safety.get("is_nsfw", False) or safety.get("blur_recommended", False)
        content_warning = safety.get("content_warning")
        
        # Save to database
        db = get_db_router()
        evidence_id = db.save_evidence(
            user_id=user_id,
            case_id=case_id,
            file_type="image",
            file_path=str(file_path),
            original_filename=file.filename,
            file_size=file_size,
            analysis_json=json.dumps(analysis),
            is_nsfw=is_nsfw,
            content_warning=content_warning
        )
        
        # Log audit
        db.log_audit(
            user_id=user_id,
            action="evidence_upload",
            resource_type="evidence",
            resource_id=evidence_id,
            details=f"Image uploaded: {file.filename}"
        )
        
        return EvidenceUploadResponse(
            success=True,
            evidence_id=evidence_id,
            message="Image analyzed successfully",
            analysis=analysis,
            is_nsfw=is_nsfw,
            content_warning=content_warning
        )
        
    except Exception as e:
        # Clean up file on error
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/analyze-video", response_model=EvidenceUploadResponse)
async def upload_and_analyze_video(
    file: UploadFile = File(...),
    case_id: int = Form(...),
    case_type: str = Form("general"),
    description: str = Form(""),
    sample_rate: int = Form(30),
    max_frames: int = Form(20),
    user_id: int = Form(...)
):
    """
    Upload and analyze a video for evidence.
    
    - Supports MP4, MOV, AVI
    - Max size: 100MB
    - Extracts frames and analyzes each
    - Generates timeline and key moments
    
    Parameters:
    - sample_rate: Take 1 frame every N frames (30 = ~1/sec for 30fps)
    - max_frames: Maximum frames to analyze (20 = ~20 API calls)
    """
    if not analyzer:
        raise HTTPException(
            status_code=503,
            detail="Evidence analyzer not available. Install dependencies."
        )
    
    # Validate file type
    allowed_types = [".mp4", ".mov", ".avi", ".mkv"]
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )
    
    # Validate file size (100MB)
    contents = await file.read()
    file_size = len(contents)
    if file_size > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 100MB limit")
    
    # Create user evidence directory
    user_dir = EVIDENCE_DIR / f"user_{user_id}"
    user_dir.mkdir(exist_ok=True)
    
    # Save file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"evidence_{case_id}_{timestamp}{ext}"
    file_path = user_dir / safe_filename
    
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Analyze video
    try:
        result = analyzer.analyze_video(
            video_path=str(file_path),
            case_type=case_type,
            description=description,
            sample_rate=sample_rate,
            max_frames=max_frames
        )
        
        if not result["success"]:
            # Still save the evidence
            db = get_db_router()
            evidence_id = db.save_evidence(
                user_id=user_id,
                case_id=case_id,
                file_type="video",
                file_path=str(file_path),
                original_filename=file.filename,
                file_size=file_size
            )
            
            return EvidenceUploadResponse(
                success=True,
                evidence_id=evidence_id,
                message=f"Video saved but analysis failed: {result.get('error', 'Unknown')}",
                is_nsfw=False
            )
        
        # Extract safety flags
        analysis = result.get("analysis", {})
        is_nsfw = analysis.get("is_nsfw", False) or analysis.get("blur_recommended", False)
        content_warnings = analysis.get("content_warnings", [])
        content_warning = "; ".join(content_warnings) if content_warnings else None
        
        # Save to database
        db = get_db_router()
        evidence_id = db.save_evidence(
            user_id=user_id,
            case_id=case_id,
            file_type="video",
            file_path=str(file_path),
            original_filename=file.filename,
            file_size=file_size,
            analysis_json=json.dumps(analysis),
            is_nsfw=is_nsfw,
            content_warning=content_warning
        )
        
        # Log audit
        db.log_audit(
            user_id=user_id,
            action="evidence_upload",
            resource_type="evidence",
            resource_id=evidence_id,
            details=f"Video uploaded: {file.filename}, {analysis.get('frames_analyzed', 0)} frames analyzed"
        )
        
        frames_analyzed = analysis.get("frames_analyzed", 0)
        
        return EvidenceUploadResponse(
            success=True,
            evidence_id=evidence_id,
            message=f"Video analyzed successfully. {frames_analyzed} frames processed.",
            analysis=analysis,
            is_nsfw=is_nsfw,
            content_warning=content_warning
        )
        
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Video analysis failed: {str(e)}")


# ====================== GET ENDPOINTS ======================

@router.get("/recent", response_model=List[dict])
async def get_recent_evidence(
    user_id: int = Query(...),
    limit: int = 50
):
    """
    Get recent evidence from ALL cases for the user.
    Used for Dashboard Evidence Gallery.
    """
    db = get_db_router()
    evidence_rows = db.get_all_user_evidence(user_id, limit)
    
    items = []
    for row in evidence_rows:
        # Parse analysis if available
        analysis = None
        if row["analysis_json"]:
            try:
                analysis = json.loads(row["analysis_json"])
            except:
                pass
        
        items.append({
            "evidence_id": row["evidence_id"],
            "case_id": row["case_id"],
            "client_name": row["client_name"],
            "file_type": row["file_type"],
            "original_filename": row["original_filename"],
            "file_size": row["file_size"],
            "uploaded_at": row["uploaded_at"],
            "is_nsfw": bool(row["is_nsfw"]),
            "content_warning": row["content_warning"],
            "thumbnail_path": row["thumbnail_path"],
            "analysis": analysis
        })
    
    return items


@router.get("/{case_id}", response_model=CaseEvidenceResponse)
async def get_case_evidence(
    case_id: int,
    user_id: int = Query(...)
):
    """Get all evidence items for a case."""
    db = get_db_router()
    evidence_rows = db.get_case_evidence(user_id, case_id)
    
    items = []
    for row in evidence_rows:
        analysis = None
        if row["analysis_json"]:
            try:
                analysis = json.loads(row["analysis_json"])
            except:
                pass
        
        items.append({
            "evidence_id": row["evidence_id"],
            "case_id": row["case_id"],
            "file_type": row["file_type"],
            "original_filename": row["original_filename"],
            "file_size": row["file_size"],
            "uploaded_at": row["uploaded_at"],
            "is_nsfw": bool(row["is_nsfw"]),
            "content_warning": row["content_warning"],
            "analysis": analysis
        })
    
    return CaseEvidenceResponse(
        case_id=case_id,
        evidence_items=items,
        total=len(items)
    )


@router.get("/item/{evidence_id}")
async def get_evidence_details(
    evidence_id: int,
    user_id: int = Query(...)
):
    """Get detailed information about a specific evidence item."""
    db = get_db_router()
    row = db.get_evidence_item(user_id, evidence_id)
    
    if not row:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    analysis = None
    if row["analysis_json"]:
        try:
            analysis = json.loads(row["analysis_json"])
        except:
            pass
    
    return {
        "evidence_id": row["evidence_id"],
        "case_id": row["case_id"],
        "file_type": row["file_type"],
        "file_path": row["file_path"],
        "original_filename": row["original_filename"],
        "file_size": row["file_size"],
        "uploaded_at": row["uploaded_at"],
        "is_nsfw": bool(row["is_nsfw"]),
        "content_warning": row["content_warning"],
        "analysis": analysis
    }


@router.get("/file/{evidence_id}")
async def get_evidence_file(
    evidence_id: int,
    user_id: int = Query(...),
    blurred: bool = Query(False)
):
    """
    Get the actual evidence file.
    
    If blurred=True and image is NSFW, returns blurred version.
    """
    db = get_db_router()
    row = db.get_evidence_item(user_id, evidence_id)
    
    if not row:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    file_path = Path(row["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    # If NSFW and blurred requested, return blurred version
    if blurred and row["is_nsfw"] and row["file_type"] == "image" and analyzer:
        blurred_path = file_path.parent / f"{file_path.stem}_blurred{file_path.suffix}"
        
        if not blurred_path.exists():
            analyzer.blur_image(str(file_path), str(blurred_path))
        
        if blurred_path.exists():
            return FileResponse(
                str(blurred_path),
                filename=f"blurred_{row['original_filename']}"
            )
    
    return FileResponse(
        str(file_path),
        filename=row["original_filename"]
    )


@router.get("/annotated/{evidence_id}")
async def get_annotated_evidence(
    evidence_id: int,
    user_id: int = Query(...)
):
    """
    Get image with bounding boxes drawn on detected objects.
    
    Only works for images with analysis results.
    """
    if not analyzer:
        raise HTTPException(status_code=503, detail="Analyzer not available")
    
    db = get_db_router()
    row = db.get_evidence_item(user_id, evidence_id)
    
    if not row:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    if row["file_type"] != "image":
        raise HTTPException(status_code=400, detail="Annotations only available for images")
    
    file_path = Path(row["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    # Parse analysis
    if not row["analysis_json"]:
        raise HTTPException(status_code=400, detail="No analysis available for this image")
    
    try:
        analysis = json.loads(row["analysis_json"])
    except:
        raise HTTPException(status_code=500, detail="Failed to parse analysis")
    
    # Generate annotated image
    annotated_path = file_path.parent / f"{file_path.stem}_annotated{file_path.suffix}"
    
    if not annotated_path.exists():
        result = analyzer.draw_bounding_boxes(str(file_path), analysis, str(annotated_path))
        if not result:
            raise HTTPException(status_code=500, detail="Failed to generate annotated image")
    
    return FileResponse(
        str(annotated_path),
        filename=f"annotated_{row['original_filename']}"
    )


# ====================== DELETE ENDPOINT ======================

@router.delete("/{evidence_id}")
async def delete_evidence(
    evidence_id: int,
    user_id: int = Query(...)
):
    """Delete an evidence item and its file."""
    db = get_db_router()
    row = db.get_evidence_item(user_id, evidence_id)
    
    if not row:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    # Delete file from disk
    file_path = Path(row["file_path"])
    if file_path.exists():
        file_path.unlink()
    
    # Delete annotated/blurred versions if they exist
    if row["file_type"] == "image":
        for suffix in ["_annotated", "_blurred"]:
            variant_path = file_path.parent / f"{file_path.stem}{suffix}{file_path.suffix}"
            if variant_path.exists():
                variant_path.unlink()
    
    # Delete from database
    success = db.delete_evidence(user_id, evidence_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete from database")
    
    # Log audit
    db.log_audit(
        user_id=user_id,
        action="evidence_delete",
        resource_type="evidence",
        resource_id=evidence_id,
        details=f"Evidence deleted: {row['original_filename']}"
    )
    
    return {"success": True, "message": "Evidence deleted successfully"}


# Export router
__all__ = ['router']
