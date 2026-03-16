/**
 * EvidencePanel Component
 * Displays and manages visual evidence for a case
 * Includes upload, gallery view, analysis display, and NSFW blur
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    uploadEvidenceImage,
    uploadEvidenceVideo,
    getCaseEvidence,
    deleteEvidence,
    getEvidenceFileUrl,
    getAnnotatedEvidenceUrl,
    formatFileSize,
    formatTimestamp,
    type EvidenceItem,
    type EvidenceAnalysis,
} from "./api/evidenceApi";

interface EvidencePanelProps {
    caseId: number;
    userId: number;
    caseType?: string;
    onClose?: () => void;
}

export default function EvidencePanel({
    caseId,
    userId,
    caseType = "general",
    onClose,
}: EvidencePanelProps) {
    const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [revealedNsfw, setRevealedNsfw] = useState<Set<number>>(new Set());

    // Load evidence on mount
    const loadEvidence = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await getCaseEvidence(caseId, userId);
            setEvidence(result.evidence_items);
        } catch (err) {
            setError("Failed to load evidence");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [caseId, userId]);

    useEffect(() => {
        loadEvidence();
    }, [loadEvidence]);

    // Handle image upload
    const handleImageUpload = async (file: File, description: string) => {
        setUploadingImage(true);
        setError(null);
        try {
            const result = await uploadEvidenceImage(file, caseId, userId, caseType, description);
            if (result.success) {
                await loadEvidence();
                setShowUploadModal(false);
            } else {
                setError(result.message);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploadingImage(false);
        }
    };

    // Handle video upload
    const handleVideoUpload = async (file: File, description: string) => {
        setUploadingVideo(true);
        setError(null);
        try {
            const result = await uploadEvidenceVideo(file, caseId, userId, caseType, description);
            if (result.success) {
                await loadEvidence();
                setShowUploadModal(false);
            } else {
                setError(result.message);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploadingVideo(false);
        }
    };

    // Handle delete
    const handleDelete = async (evidenceId: number) => {
        if (!confirm("Are you sure you want to delete this evidence?")) return;

        try {
            await deleteEvidence(evidenceId, userId);
            setEvidence(prev => prev.filter(e => e.evidence_id !== evidenceId));
            if (selectedEvidence?.evidence_id === evidenceId) {
                setSelectedEvidence(null);
            }
        } catch (err) {
            setError("Failed to delete evidence");
        }
    };

    // Toggle NSFW reveal
    const toggleNsfwReveal = (evidenceId: number) => {
        setRevealedNsfw(prev => {
            const newSet = new Set(prev);
            if (newSet.has(evidenceId)) {
                newSet.delete(evidenceId);
            } else {
                newSet.add(evidenceId);
            }
            return newSet;
        });
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-lg font-medium text-[#1a1a1a] flex items-center gap-2">
                    🔬 Visual Evidence
                    <span className="text-sm font-normal text-[#666]">({evidence.length} items)</span>
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-medium hover:bg-[#ea580c] transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Evidence
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-[#e5ddd0] rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
                    {error}
                    <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <svg className="w-8 h-8 animate-spin text-[#f97316]" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    </div>
                ) : evidence.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-[#666]">
                        <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">No evidence uploaded yet</p>
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="mt-4 px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm hover:bg-[#ea580c]"
                        >
                            Upload First Evidence
                        </button>
                    </div>
                ) : selectedEvidence ? (
                    // Detail View
                    <EvidenceDetailView
                        evidence={selectedEvidence}
                        userId={userId}
                        revealed={revealedNsfw.has(selectedEvidence.evidence_id)}
                        onReveal={() => toggleNsfwReveal(selectedEvidence.evidence_id)}
                        onDelete={() => handleDelete(selectedEvidence.evidence_id)}
                        onBack={() => setSelectedEvidence(null)}
                    />
                ) : (
                    // Gallery Grid
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {evidence.map(item => (
                            <EvidenceCard
                                key={item.evidence_id}
                                evidence={item}
                                userId={userId}
                                revealed={revealedNsfw.has(item.evidence_id)}
                                onReveal={() => toggleNsfwReveal(item.evidence_id)}
                                onClick={() => setSelectedEvidence(item)}
                                onDelete={() => handleDelete(item.evidence_id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            <AnimatePresence>
                {showUploadModal && (
                    <UploadModal
                        onClose={() => setShowUploadModal(false)}
                        onImageUpload={handleImageUpload}
                        onVideoUpload={handleVideoUpload}
                        uploadingImage={uploadingImage}
                        uploadingVideo={uploadingVideo}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ==================== SUB-COMPONENTS ====================

interface EvidenceCardProps {
    evidence: EvidenceItem;
    userId: number;
    revealed: boolean;
    onReveal: () => void;
    onClick: () => void;
    onDelete: () => void;
}

function EvidenceCard({ evidence, userId, revealed, onReveal, onClick, onDelete }: EvidenceCardProps) {
    const isNsfw = evidence.is_nsfw && !revealed;
    const imageUrl = getEvidenceFileUrl(evidence.evidence_id, userId, isNsfw);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative group rounded-lg overflow-hidden border border-[#d4b896] bg-white shadow-sm hover:shadow-md transition-shadow"
        >
            {/* Thumbnail */}
            <div className="aspect-video relative cursor-pointer" onClick={onClick}>
                {evidence.file_type === "image" ? (
                    <>
                        <img
                            src={imageUrl}
                            alt={evidence.original_filename}
                            className={`w-full h-full object-cover ${isNsfw ? "blur-xl" : ""}`}
                        />
                        {isNsfw && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                                <span className="text-xs">Content Warning</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onReveal(); }}
                                    className="mt-2 px-3 py-1 bg-white/20 rounded text-xs hover:bg-white/30"
                                >
                                    Click to reveal
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </div>
                )}

                {/* File type badge */}
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded">
                    {evidence.file_type === "image" ? "📷" : "🎥"} {evidence.file_type.toUpperCase()}
                </div>

                {/* Analysis indicator */}
                {evidence.analysis && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-green-500/90 text-white text-xs rounded">
                        ✓ Analyzed
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-2">
                <p className="text-xs text-[#1a1a1a] truncate font-medium">{evidence.original_filename}</p>
                <p className="text-xs text-[#666]">{formatFileSize(evidence.file_size)}</p>
            </div>

            {/* Delete button (on hover) */}
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="absolute bottom-2 right-2 p-1.5 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </motion.div>
    );
}

interface EvidenceDetailViewProps {
    evidence: EvidenceItem;
    userId: number;
    revealed: boolean;
    onReveal: () => void;
    onDelete: () => void;
    onBack: () => void;
}

function EvidenceDetailView({ evidence, userId, revealed, onReveal, onDelete, onBack }: EvidenceDetailViewProps) {
    const [showAnnotated, setShowAnnotated] = useState(false);
    const isNsfw = evidence.is_nsfw && !revealed;

    const imageUrl = showAnnotated
        ? getAnnotatedEvidenceUrl(evidence.evidence_id, userId)
        : getEvidenceFileUrl(evidence.evidence_id, userId, false);

    const analysis = evidence.analysis;

    return (
        <div className="space-y-4">
            {/* Back button */}
            <button onClick={onBack} className="flex items-center gap-2 text-[#666] hover:text-[#1a1a1a] text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to gallery
            </button>

            {/* Image/Video */}
            <div className="relative rounded-lg overflow-hidden bg-gray-100">
                {evidence.file_type === "image" ? (
                    <>
                        <img
                            src={imageUrl}
                            alt={evidence.original_filename}
                            className={`w-full max-h-96 object-contain ${isNsfw ? "blur-xl" : ""}`}
                        />
                        {isNsfw && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white">
                                <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <p className="font-medium mb-1">Content Warning</p>
                                <p className="text-sm text-gray-300 mb-4">{evidence.content_warning || "This content may be sensitive"}</p>
                                <button
                                    onClick={onReveal}
                                    className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                                >
                                    Click to reveal content
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <video
                        src={getEvidenceFileUrl(evidence.evidence_id, userId, false)}
                        controls
                        className="w-full max-h-96"
                    />
                )}
            </div>

            {/* Toggle annotated view */}
            {evidence.file_type === "image" && analysis && !isNsfw && (
                <button
                    onClick={() => setShowAnnotated(!showAnnotated)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showAnnotated
                            ? "bg-[#f97316] text-white"
                            : "bg-[#e5ddd0] text-[#666] hover:bg-[#d4c4a8]"
                        }`}
                >
                    {showAnnotated ? "🔲 Hide Bounding Boxes" : "🔲 Show Bounding Boxes"}
                </button>
            )}

            {/* File info */}
            <div className="bg-[#f5f1e8] p-4 rounded-lg">
                <h4 className="font-medium text-[#1a1a1a] mb-2">File Information</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-[#666]">Filename:</span> {evidence.original_filename}</div>
                    <div><span className="text-[#666]">Size:</span> {formatFileSize(evidence.file_size)}</div>
                    <div><span className="text-[#666]">Type:</span> {evidence.file_type.toUpperCase()}</div>
                    <div><span className="text-[#666]">Uploaded:</span> {new Date(evidence.uploaded_at).toLocaleDateString()}</div>
                </div>
            </div>

            {/* Analysis Results */}
            {analysis && (
                <AnalysisDisplay analysis={analysis} />
            )}

            {/* Delete */}
            <button
                onClick={onDelete}
                className="w-full py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
                🗑️ Delete Evidence
            </button>
        </div>
    );
}

interface AnalysisDisplayProps {
    analysis: EvidenceAnalysis;
}

function AnalysisDisplay({ analysis }: AnalysisDisplayProps) {
    return (
        <div className="space-y-4">
            {/* Scene Description */}
            {analysis.scene_description && (
                <div className="bg-[#f5f1e8] p-4 rounded-lg">
                    <h4 className="font-medium text-[#1a1a1a] mb-2">📷 Scene Description</h4>
                    <p className="text-sm text-[#1a1a1a]">{analysis.scene_description}</p>
                </div>
            )}

            {/* Key Findings */}
            {analysis.key_findings && analysis.key_findings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2">⚡ Key Findings</h4>
                    <ul className="list-disc list-inside text-sm text-yellow-900 space-y-1">
                        {analysis.key_findings.map((finding, idx) => (
                            <li key={idx}>{finding}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Detected Objects */}
            {analysis.detected_objects && analysis.detected_objects.length > 0 && (
                <div className="bg-[#f5f1e8] p-4 rounded-lg">
                    <h4 className="font-medium text-[#1a1a1a] mb-2">🔍 Detected Objects</h4>
                    <div className="flex flex-wrap gap-2">
                        {analysis.detected_objects.map((obj, idx) => (
                            <span
                                key={idx}
                                className="px-2 py-1 bg-white border border-[#d4b896] rounded text-xs"
                            >
                                {obj.object} ({Math.round((obj.confidence || 0) * 100)}%)
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Extracted Text */}
            {analysis.text_extracted && analysis.text_extracted.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">📝 Extracted Text</h4>
                    <div className="space-y-2">
                        {analysis.text_extracted.map((text, idx) => (
                            <div key={idx} className="text-sm">
                                <span className="text-blue-600 text-xs">[{text.type}]</span>{" "}
                                <span className="text-blue-900">"{text.text}"</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Evidence Items */}
            {analysis.evidence_items && analysis.evidence_items.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                    <h4 className="font-medium text-purple-800 mb-2">🔬 Evidence Items</h4>
                    <div className="space-y-2">
                        {analysis.evidence_items.map((item, idx) => (
                            <div key={idx} className="text-sm">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${item.importance === "high" ? "bg-red-100 text-red-700" :
                                        item.importance === "medium" ? "bg-yellow-100 text-yellow-700" :
                                            "bg-gray-100 text-gray-700"
                                    }`}>
                                    {item.importance.toUpperCase()}
                                </span>{" "}
                                <span className="font-medium text-purple-900">{item.item}</span>
                                <p className="text-purple-700 ml-2">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Video Timeline */}
            {analysis.timeline && analysis.timeline.length > 0 && (
                <div className="bg-[#f5f1e8] p-4 rounded-lg">
                    <h4 className="font-medium text-[#1a1a1a] mb-2">🎬 Video Timeline</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {analysis.timeline.map((moment, idx) => (
                            <div key={idx} className="flex gap-3 text-sm border-l-2 border-[#f97316] pl-3">
                                <span className="text-[#f97316] font-mono w-12 shrink-0">
                                    {formatTimestamp(moment.timestamp)}
                                </span>
                                <span className="text-[#1a1a1a]">{moment.description}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Key Moments */}
            {analysis.key_moments && analysis.key_moments.length > 0 && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">⭐ Key Moments</h4>
                    <div className="space-y-2">
                        {analysis.key_moments.map((moment, idx) => (
                            <div key={idx} className="text-sm">
                                <span className="text-green-600 font-mono">@ {formatTimestamp(moment.timestamp)}</span>
                                <ul className="list-disc list-inside text-green-900 ml-2">
                                    {moment.findings.map((finding, fidx) => (
                                        <li key={fidx}>{finding}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Relevance Score */}
            {typeof analysis.overall_relevance === "number" && (
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-[#666]">Evidence Relevance:</span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-[#f97316] to-[#ea580c]"
                            style={{ width: `${analysis.overall_relevance * 100}%` }}
                        />
                    </div>
                    <span className="font-medium">{Math.round(analysis.overall_relevance * 100)}%</span>
                </div>
            )}
        </div>
    );
}

interface UploadModalProps {
    onClose: () => void;
    onImageUpload: (file: File, description: string) => void;
    onVideoUpload: (file: File, description: string) => void;
    uploadingImage: boolean;
    uploadingVideo: boolean;
}

function UploadModal({ onClose, onImageUpload, onVideoUpload, uploadingImage, uploadingVideo }: UploadModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [description, setDescription] = useState("");
    const [fileType, setFileType] = useState<"image" | "video" | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const isVideo = selectedFile.type.startsWith("video/");
            setFileType(isVideo ? "video" : "image");
        }
    };

    const handleUpload = () => {
        if (!file || !fileType) return;

        if (fileType === "image") {
            onImageUpload(file, description);
        } else {
            onVideoUpload(file, description);
        }
    };

    const isUploading = uploadingImage || uploadingVideo;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#f5f1e8] rounded-xl w-full max-w-md shadow-2xl border border-[#d4b896]"
            >
                <div className="p-6 border-b border-[#d4b896] flex justify-between items-center">
                    <h2 className="text-lg font-medium text-[#1a1a1a]">Upload Evidence</h2>
                    <button onClick={onClose} className="p-2 hover:bg-[#e5ddd0] rounded-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* File input */}
                    <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${file ? "border-green-500 bg-green-50" : "border-[#d4b896] hover:border-[#f97316]"
                        }`}>
                        {file ? (
                            <div className="flex items-center justify-center gap-3">
                                <span className="text-2xl">{fileType === "video" ? "🎥" : "📷"}</span>
                                <div className="text-left">
                                    <p className="font-medium text-[#1a1a1a]">{file.name}</p>
                                    <p className="text-sm text-[#666]">{formatFileSize(file.size)}</p>
                                </div>
                                <button onClick={() => { setFile(null); setFileType(null); }} className="p-1 hover:bg-red-100 rounded">
                                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <label className="cursor-pointer">
                                <svg className="w-10 h-10 mx-auto text-[#d4b896] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <span className="text-[#1a1a1a] font-medium">Click to upload</span>
                                <p className="text-xs text-[#666] mt-1">Images (JPG, PNG) up to 10MB or Videos up to 100MB</p>
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
                            Description (optional)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the context of this evidence..."
                            rows={3}
                            className="w-full px-3 py-2 bg-white border border-[#d4b896] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                        />
                    </div>

                    {/* Warning for videos */}
                    {fileType === "video" && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                            ⚠️ Video analysis may take 1-2 minutes as we analyze multiple frames.
                        </div>
                    )}

                    {/* Upload button */}
                    <button
                        onClick={handleUpload}
                        disabled={!file || isUploading}
                        className="w-full py-3 bg-[#f97316] text-white font-medium rounded-lg hover:bg-[#ea580c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                        {isUploading ? (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                {fileType === "video" ? "Analyzing video frames..." : "Analyzing image..."}
                            </>
                        ) : (
                            <>Upload & Analyze</>
                        )}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
