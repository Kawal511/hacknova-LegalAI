"""
Visual Evidence Analyzer using Google Gemini Vision API
=======================================================
Analyzes images and videos for legal evidence with:
- Object detection with bounding boxes
- OCR text extraction
- Scene understanding
- NSFW/safety detection
- Rate limiting
"""

import os
import json
import time
import base64
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path
import threading

# Third-party imports
try:
    import google.generativeai as genai
    from PIL import Image
    import cv2
    DEPS_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Some dependencies not available: {e}")
    DEPS_AVAILABLE = False

from dotenv import load_dotenv
load_dotenv()


class RateLimiter:
    """Simple rate limiter for Gemini API (15 req/min)"""
    
    def __init__(self, max_requests: int = 15, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = []
        self.lock = threading.Lock()
    
    def acquire(self) -> bool:
        """Wait until we can make a request"""
        with self.lock:
            now = time.time()
            # Remove old requests outside the window
            self.requests = [t for t in self.requests if now - t < self.window_seconds]
            
            if len(self.requests) >= self.max_requests:
                # Wait until oldest request expires
                wait_time = self.window_seconds - (now - self.requests[0]) + 0.5
                if wait_time > 0:
                    time.sleep(wait_time)
                self.requests = self.requests[1:]
            
            self.requests.append(time.time())
            return True


class EvidenceAnalyzer:
    """Analyzes visual evidence using Gemini Vision API"""
    
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        if not DEPS_AVAILABLE:
            raise ImportError("Required dependencies not available. Run: pip install -r requirements_evidence.txt")
        
        # Configure Gemini
        genai.configure(api_key=self.api_key)
        # Using gemini-3-flash-preview as requested by user
        self.model = genai.GenerativeModel('gemini-3-flash-preview')
        
        # Rate limiter (15 requests per minute for free tier)
        self.rate_limiter = RateLimiter(max_requests=15, window_seconds=60)
        
        # Evidence storage directory
        self.evidence_dir = Path("evidence_files")
        self.evidence_dir.mkdir(exist_ok=True)
    
    def _encode_image(self, image_path: str) -> Dict[str, Any]:
        """Encode image for Gemini API"""
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")
        
        # Determine mime type
        ext = Path(image_path).suffix.lower()
        mime_types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp"
        }
        mime_type = mime_types.get(ext, "image/jpeg")
        
        return {
            "mime_type": mime_type,
            "data": image_data
        }
    
    def _get_analysis_prompt(self, case_type: str, description: str = "") -> str:
        """Generate prompt for evidence analysis"""
        
        case_specific = {
            "criminal": "Pay special attention to: weapons, drugs, injuries, blood, suspicious items, potential evidence of crime, suspects, identifying features.",
            "accident": "Pay special attention to: vehicle damage, road conditions, traffic signs, skid marks, injuries, weather conditions, visibility.",
            "civil": "Pay special attention to: property damage, documents, signatures, boundaries, possessions, conditions of premises.",
            "general": "Analyze all visible elements that could be relevant as legal evidence."
        }
        
        context = case_specific.get(case_type.lower(), case_specific["general"])
        
        prompt = f"""You are a forensic evidence analyzer for legal cases. Analyze this image thoroughly.

CASE TYPE: {case_type.upper()}
{f'CONTEXT: {description}' if description else ''}

{context}

Provide your analysis in the following JSON format:
{{
    "scene_description": "Detailed description of the scene",
    "detected_objects": [
        {{
            "object": "name of object",
            "confidence": 0.0-1.0,
            "significance": "legal relevance",
            "bbox": {{"x1": 0.0-1.0, "y1": 0.0-1.0, "x2": 0.0-1.0, "y2": 0.0-1.0}}
        }}
    ],
    "people_detected": [
        {{
            "description": "person description",
            "estimated_age": "age range",
            "clothing": "clothing description",
            "activity": "what they're doing",
            "bbox": {{"x1": 0.0-1.0, "y1": 0.0-1.0, "x2": 0.0-1.0, "y2": 0.0-1.0}}
        }}
    ],
    "text_extracted": [
        {{
            "text": "extracted text",
            "type": "document/sign/label/etc",
            "bbox": {{"x1": 0.0-1.0, "y1": 0.0-1.0, "x2": 0.0-1.0, "y2": 0.0-1.0}}
        }}
    ],
    "key_findings": ["Important finding 1", "Important finding 2"],
    "evidence_items": [
        {{
            "item": "potential evidence",
            "importance": "high/medium/low",
            "description": "why it's relevant"
        }}
    ],
    "safety_assessment": {{
        "is_nsfw": false,
        "is_violent": false,
        "is_graphic": false,
        "content_warning": null,
        "blur_recommended": false
    }},
    "overall_relevance": 0.0-1.0,
    "analysis_notes": "Additional observations"
}}

IMPORTANT:
1. Bounding boxes use normalized coordinates (0.0 to 1.0) where (0,0) is top-left
2. Be thorough but only report what you can actually see
3. Mark is_nsfw=true if image contains explicit content, nudity, or disturbing imagery
4. Mark blur_recommended=true if image should be blurred before display

Return ONLY valid JSON, no markdown formatting."""
        
        return prompt
    
    def analyze_image(self, image_path: str, case_type: str = "general", 
                      description: str = "") -> Dict[str, Any]:
        """
        Analyze an image for evidence
        
        Args:
            image_path: Path to the image file
            case_type: Type of case (criminal, accident, civil, general)
            description: Optional context about the case
            
        Returns:
            Dict with analysis results
        """
        try:
            # Rate limiting
            self.rate_limiter.acquire()
            
            # Load and validate image
            if not os.path.exists(image_path):
                return {"success": False, "error": "Image file not found"}
            
            # Check file size (10MB limit)
            file_size = os.path.getsize(image_path)
            if file_size > 10 * 1024 * 1024:
                return {"success": False, "error": "Image exceeds 10MB limit"}
            
            # Upload image to Gemini
            img = Image.open(image_path)
            
            # Get analysis prompt
            prompt = self._get_analysis_prompt(case_type, description)
            
            # Call Gemini Vision
            response = self.model.generate_content([prompt, img])
            
            # Parse response
            response_text = response.text.strip()
            
            # Clean JSON if wrapped in markdown
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
            response_text = response_text.strip()
            
            try:
                analysis = json.loads(response_text)
            except json.JSONDecodeError:
                # Try to extract JSON from response
                import re
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    analysis = json.loads(json_match.group())
                else:
                    return {
                        "success": False, 
                        "error": "Failed to parse analysis response",
                        "raw_response": response_text[:500]
                    }
            
            return {
                "success": True,
                "file_type": "image",
                "file_path": image_path,
                "analyzed_at": datetime.now().isoformat(),
                "case_type": case_type,
                "analysis": analysis
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "file_path": image_path
            }
    
    def analyze_video(self, video_path: str, case_type: str = "general",
                      description: str = "", sample_rate: int = 30,
                      max_frames: int = 20) -> Dict[str, Any]:
        """
        Analyze a video for evidence by sampling frames
        
        Args:
            video_path: Path to the video file
            case_type: Type of case
            description: Optional context
            sample_rate: Take 1 frame every N frames (30 = ~1 per second for 30fps)
            max_frames: Maximum frames to analyze
            
        Returns:
            Dict with timeline and key moments
        """
        try:
            if not os.path.exists(video_path):
                return {"success": False, "error": "Video file not found"}
            
            # Check file size (100MB limit)
            file_size = os.path.getsize(video_path)
            if file_size > 100 * 1024 * 1024:
                return {"success": False, "error": "Video exceeds 100MB limit"}
            
            # Open video
            cap = cv2.VideoCapture(video_path)
            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = total_frames / fps if fps > 0 else 0
            
            # Extract frames
            frames = []
            frame_count = 0
            analyzed_count = 0
            
            while cap.isOpened() and analyzed_count < max_frames:
                ret, frame = cap.read()
                if not ret:
                    break
                
                if frame_count % sample_rate == 0:
                    # Save frame temporarily
                    temp_path = f"/tmp/frame_{analyzed_count}.jpg"
                    cv2.imwrite(temp_path, frame)
                    
                    timestamp = frame_count / fps if fps > 0 else 0
                    frames.append({
                        "frame_number": frame_count,
                        "timestamp": timestamp,
                        "temp_path": temp_path
                    })
                    analyzed_count += 1
                
                frame_count += 1
            
            cap.release()
            
            # Analyze each frame
            timeline = []
            key_moments = []
            is_nsfw = False
            content_warnings = []
            
            for i, frame_info in enumerate(frames):
                print(f"Analyzing frame {i+1}/{len(frames)} @ {frame_info['timestamp']:.2f}s")
                
                result = self.analyze_image(
                    frame_info["temp_path"],
                    case_type=case_type,
                    description=f"{description} - Frame at {frame_info['timestamp']:.2f} seconds"
                )
                
                if result["success"]:
                    analysis = result["analysis"]
                    
                    timeline.append({
                        "frame_number": frame_info["frame_number"],
                        "timestamp": frame_info["timestamp"],
                        "description": analysis.get("scene_description", ""),
                        "detected_objects": analysis.get("detected_objects", []),
                        "key_findings": analysis.get("key_findings", [])
                    })
                    
                    # Check for key moments (high relevance or important findings)
                    relevance = analysis.get("overall_relevance", 0)
                    if relevance > 0.7 or analysis.get("key_findings"):
                        key_moments.append({
                            "timestamp": frame_info["timestamp"],
                            "findings": analysis.get("key_findings", []),
                            "relevance": relevance,
                            "analysis": analysis
                        })
                    
                    # Track safety flags
                    safety = analysis.get("safety_assessment", {})
                    if safety.get("is_nsfw") or safety.get("blur_recommended"):
                        is_nsfw = True
                    if safety.get("content_warning"):
                        content_warnings.append(safety["content_warning"])
                
                # Clean up temp file
                try:
                    os.remove(frame_info["temp_path"])
                except:
                    pass
                
                # Rate limiting delay
                time.sleep(4)  # Stay well under 15 req/min
            
            return {
                "success": True,
                "file_type": "video",
                "file_path": video_path,
                "analyzed_at": datetime.now().isoformat(),
                "case_type": case_type,
                "analysis": {
                    "duration_seconds": duration,
                    "fps": fps,
                    "total_frames": total_frames,
                    "frames_analyzed": len(frames),
                    "timeline": timeline,
                    "key_moments": key_moments,
                    "is_nsfw": is_nsfw,
                    "content_warnings": list(set(content_warnings)),
                    "blur_recommended": is_nsfw
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "file_path": video_path
            }
    
    def draw_bounding_boxes(self, image_path: str, analysis: Dict[str, Any],
                            output_path: Optional[str] = None) -> Optional[str]:
        """
        Draw bounding boxes on an image based on analysis results
        
        Args:
            image_path: Path to original image
            analysis: Analysis results containing bounding box data
            output_path: Where to save annotated image (default: adds _annotated)
            
        Returns:
            Path to annotated image
        """
        try:
            img = cv2.imread(image_path)
            if img is None:
                return None
            
            h, w = img.shape[:2]
            
            # Color scheme (BGR)
            colors = {
                "object": (0, 0, 255),      # Red
                "person": (0, 255, 0),       # Green
                "text": (255, 0, 0),         # Blue
                "evidence": (255, 0, 255),   # Magenta
                "key": (0, 255, 255)         # Yellow
            }
            
            # Draw detected objects
            for obj in analysis.get("detected_objects", []):
                bbox = obj.get("bbox", {})
                if bbox:
                    x1 = int(bbox.get("x1", 0) * w)
                    y1 = int(bbox.get("y1", 0) * h)
                    x2 = int(bbox.get("x2", 1) * w)
                    y2 = int(bbox.get("y2", 1) * h)
                    
                    cv2.rectangle(img, (x1, y1), (x2, y2), colors["object"], 2)
                    label = obj.get("object", "Object")
                    cv2.putText(img, label, (x1, y1 - 10), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, colors["object"], 2)
            
            # Draw people
            for person in analysis.get("people_detected", []):
                bbox = person.get("bbox", {})
                if bbox:
                    x1 = int(bbox.get("x1", 0) * w)
                    y1 = int(bbox.get("y1", 0) * h)
                    x2 = int(bbox.get("x2", 1) * w)
                    y2 = int(bbox.get("y2", 1) * h)
                    
                    cv2.rectangle(img, (x1, y1), (x2, y2), colors["person"], 2)
                    label = "Person"
                    cv2.putText(img, label, (x1, y1 - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, colors["person"], 2)
            
            # Draw text regions
            for text_item in analysis.get("text_extracted", []):
                bbox = text_item.get("bbox", {})
                if bbox:
                    x1 = int(bbox.get("x1", 0) * w)
                    y1 = int(bbox.get("y1", 0) * h)
                    x2 = int(bbox.get("x2", 1) * w)
                    y2 = int(bbox.get("y2", 1) * h)
                    
                    cv2.rectangle(img, (x1, y1), (x2, y2), colors["text"], 2)
            
            # Save annotated image
            if output_path is None:
                base, ext = os.path.splitext(image_path)
                output_path = f"{base}_annotated{ext}"
            
            cv2.imwrite(output_path, img)
            return output_path
            
        except Exception as e:
            print(f"Error drawing bounding boxes: {e}")
            return None
    
    def blur_image(self, image_path: str, output_path: Optional[str] = None,
                   blur_strength: int = 50) -> Optional[str]:
        """
        Apply blur to an image (for NSFW content)
        
        Args:
            image_path: Path to original image
            output_path: Where to save blurred image
            blur_strength: Gaussian blur kernel size (must be odd)
            
        Returns:
            Path to blurred image
        """
        try:
            img = cv2.imread(image_path)
            if img is None:
                return None
            
            # Ensure odd kernel size
            if blur_strength % 2 == 0:
                blur_strength += 1
            
            blurred = cv2.GaussianBlur(img, (blur_strength, blur_strength), 0)
            
            if output_path is None:
                base, ext = os.path.splitext(image_path)
                output_path = f"{base}_blurred{ext}"
            
            cv2.imwrite(output_path, blurred)
            return output_path
            
        except Exception as e:
            print(f"Error blurring image: {e}")
            return None
    
    def generate_evidence_report(self, analysis: Dict[str, Any], 
                                  case_id: int = None) -> str:
        """Generate a text report from analysis results"""
        
        report = []
        report.append("=" * 70)
        report.append("EVIDENCE ANALYSIS REPORT")
        report.append("=" * 70)
        report.append("")
        
        if case_id:
            report.append(f"Case ID: #{case_id}")
        
        report.append(f"File: {analysis.get('file_path', 'Unknown')}")
        report.append(f"Type: {analysis.get('file_type', 'Unknown').upper()}")
        report.append(f"Analyzed: {analysis.get('analyzed_at', 'Unknown')}")
        report.append("")
        report.append("-" * 70)
        report.append("")
        
        if analysis.get("file_type") == "image":
            img_analysis = analysis.get("analysis", {})
            
            report.append("IMAGE ANALYSIS")
            report.append("")
            report.append(f"Scene: {img_analysis.get('scene_description', 'N/A')}")
            report.append("")
            
            objects = img_analysis.get("detected_objects", [])
            if objects:
                report.append("Detected Objects:")
                for obj in objects:
                    report.append(f"  - {obj.get('object', 'Unknown')}")
            
            texts = img_analysis.get("text_extracted", [])
            if texts:
                report.append("")
                report.append("Extracted Text:")
                for text in texts:
                    report.append(f'  "{text.get("text", "")}"')
            
            findings = img_analysis.get("key_findings", [])
            if findings:
                report.append("")
                report.append("Key Findings:")
                for finding in findings:
                    report.append(f"  • {finding}")
        
        elif analysis.get("file_type") == "video":
            vid_analysis = analysis.get("analysis", {})
            
            report.append("VIDEO ANALYSIS")
            report.append("")
            report.append(f"Duration: {vid_analysis.get('duration_seconds', 0):.2f} seconds")
            report.append(f"Frames Analyzed: {vid_analysis.get('frames_analyzed', 0)}")
            report.append("")
            
            key_moments = vid_analysis.get("key_moments", [])
            if key_moments:
                report.append("Key Moments:")
                for moment in key_moments:
                    report.append(f"  @ {moment.get('timestamp', 0):.2f}s:")
                    for finding in moment.get("findings", []):
                        report.append(f"    • {finding}")
        
        report.append("")
        report.append("=" * 70)
        
        return "\n".join(report)


# Test the analyzer
if __name__ == "__main__":
    print("🔬 Evidence Analyzer - Test Mode")
    try:
        analyzer = EvidenceAnalyzer()
        print("Evidence Analyzer initialized successfully!")
        print(f"Evidence directory: {analyzer.evidence_dir}")
    except Exception as e:
        print(f"Error initializing analyzer: {e}")
