import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Image as ImageIcon, Film, AlertTriangle } from 'lucide-react';
import { getRecentEvidence, EvidenceItem } from './api/legalResearcher';

interface EvidenceGalleryProps {
    userId: number;
    onNavigateToCase: (caseId: number) => void;
}

const EvidenceGallery: React.FC<EvidenceGalleryProps> = ({ userId, onNavigateToCase }) => {
    const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadEvidence();
    }, [userId]);

    const loadEvidence = async () => {
        try {
            const data = await getRecentEvidence(userId, 50);
            setEvidence(data);
        } catch (e) {
            console.error("Failed to load evidence gallery", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-4 text-center text-gray-500">Loading gallery...</div>;
    if (evidence.length === 0) return null;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-[#e5e7eb] p-6 mb-8">
            <h3 className="text-lg font-serif text-[#1a1a1a] mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#d4b896]" />
                Evidence Gallery
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {evidence.map((item) => (
                    <motion.div
                        key={item.evidence_id}
                        whileHover={{ scale: 1.05 }}
                        className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer border border-gray-200"
                        onClick={() => onNavigateToCase(item.case_id)}
                    >
                        {item.file_type === 'image' ? (
                            <img
                                src={`http://localhost:8000/legal/evidence/file/${item.evidence_id}?user_id=${userId}${item.is_nsfw ? '&blurred=true' : ''}`}
                                alt={item.original_filename}
                                className={`w-full h-full object-cover ${item.is_nsfw ? 'blur-md group-hover:blur-sm transition-all' : ''}`}
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.parentElement?.classList.add('bg-gray-200');
                                }}
                            />
                        ) : item.file_type === 'video' ? (
                            <div className="flex items-center justify-center w-full h-full bg-black">
                                <Film className="w-8 h-8 text-white opacity-50" />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center w-full h-full bg-gray-50">
                                <FileText className="w-8 h-8 text-gray-400" />
                            </div>
                        )}

                        {/* Overlay Info */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                            <p className="text-white text-xs font-medium truncate">{item.client_name || `Case #${item.case_id}`}</p>
                            <p className="text-gray-300 text-[10px] truncate">{item.original_filename}</p>
                        </div>

                        {/* NSFW Warning Badge */}
                        {item.is_nsfw && (
                            <div className="absolute top-1 right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default EvidenceGallery;
