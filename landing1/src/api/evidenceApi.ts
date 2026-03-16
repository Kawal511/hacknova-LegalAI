/**
 * Evidence API functions for the Legal Researcher
 * Handles evidence upload, analysis, retrieval, and deletion
 */

const API_BASE = "http://localhost:8000";

// ==================== TYPES ====================

export interface EvidenceAnalysis {
    scene_description?: string;
    detected_objects?: Array<{
        object: string;
        confidence: number;
        significance: string;
        bbox?: { x1: number; y1: number; x2: number; y2: number };
    }>;
    people_detected?: Array<{
        description: string;
        estimated_age: string;
        clothing: string;
        activity: string;
        bbox?: { x1: number; y1: number; x2: number; y2: number };
    }>;
    text_extracted?: Array<{
        text: string;
        type: string;
        bbox?: { x1: number; y1: number; x2: number; y2: number };
    }>;
    key_findings?: string[];
    evidence_items?: Array<{
        item: string;
        importance: string;
        description: string;
    }>;
    safety_assessment?: {
        is_nsfw: boolean;
        is_violent: boolean;
        is_graphic: boolean;
        content_warning: string | null;
        blur_recommended: boolean;
    };
    overall_relevance?: number;
    analysis_notes?: string;
    // Video-specific
    duration_seconds?: number;
    frames_analyzed?: number;
    timeline?: Array<{
        timestamp: number;
        description: string;
        key_findings: string[];
    }>;
    key_moments?: Array<{
        timestamp: number;
        findings: string[];
        relevance: number;
    }>;
}

export interface EvidenceItem {
    evidence_id: number;
    case_id: number;
    file_type: "image" | "video";
    original_filename: string;
    file_size: number;
    uploaded_at: string;
    is_nsfw: boolean;
    content_warning: string | null;
    analysis: EvidenceAnalysis | null;
}

export interface UploadResponse {
    success: boolean;
    evidence_id?: number;
    message: string;
    analysis?: EvidenceAnalysis;
    is_nsfw: boolean;
    content_warning?: string;
}

export interface CaseEvidenceResponse {
    case_id: number;
    evidence_items: EvidenceItem[];
    total: number;
}

// ==================== API FUNCTIONS ====================

/**
 * Upload and analyze an image for evidence
 */
export async function uploadEvidenceImage(
    file: File,
    caseId: number,
    userId: number,
    caseType: string = "general",
    description: string = ""
): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("case_id", caseId.toString());
    formData.append("user_id", userId.toString());
    formData.append("case_type", caseType);
    formData.append("description", description);

    const response = await fetch(`${API_BASE}/legal/evidence/analyze-image`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to upload image");
    }

    return response.json();
}

/**
 * Upload and analyze a video for evidence
 */
export async function uploadEvidenceVideo(
    file: File,
    caseId: number,
    userId: number,
    caseType: string = "general",
    description: string = "",
    sampleRate: number = 30,
    maxFrames: number = 20
): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("case_id", caseId.toString());
    formData.append("user_id", userId.toString());
    formData.append("case_type", caseType);
    formData.append("description", description);
    formData.append("sample_rate", sampleRate.toString());
    formData.append("max_frames", maxFrames.toString());

    const response = await fetch(`${API_BASE}/legal/evidence/analyze-video`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to upload video");
    }

    return response.json();
}

/**
 * Get all evidence items for a case
 */
export async function getCaseEvidence(
    caseId: number,
    userId: number
): Promise<CaseEvidenceResponse> {
    const response = await fetch(
        `${API_BASE}/legal/evidence/${caseId}?user_id=${userId}`,
        { signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) {
        throw new Error("Failed to fetch evidence");
    }

    return response.json();
}

/**
 * Get details for a specific evidence item
 */
export async function getEvidenceDetails(
    evidenceId: number,
    userId: number
): Promise<EvidenceItem & { file_path: string }> {
    const response = await fetch(
        `${API_BASE}/legal/evidence/item/${evidenceId}?user_id=${userId}`
    );

    if (!response.ok) {
        throw new Error("Evidence not found");
    }

    return response.json();
}

/**
 * Get URL for evidence file (optionally blurred for NSFW)
 */
export function getEvidenceFileUrl(
    evidenceId: number,
    userId: number,
    blurred: boolean = false
): string {
    return `${API_BASE}/legal/evidence/file/${evidenceId}?user_id=${userId}&blurred=${blurred}`;
}

/**
 * Get URL for annotated evidence image (with bounding boxes)
 */
export function getAnnotatedEvidenceUrl(
    evidenceId: number,
    userId: number
): string {
    return `${API_BASE}/legal/evidence/annotated/${evidenceId}?user_id=${userId}`;
}

/**
 * Delete an evidence item
 */
export async function deleteEvidence(
    evidenceId: number,
    userId: number
): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
        `${API_BASE}/legal/evidence/${evidenceId}?user_id=${userId}`,
        { method: "DELETE" }
    );

    if (!response.ok) {
        throw new Error("Failed to delete evidence");
    }

    return response.json();
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}
