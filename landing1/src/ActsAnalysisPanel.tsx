/**
 * ActsAnalysisPanel - AI-Driven Acts Analysis
 * 
 * Features:
 * - Automatically identifies relevant Indian Acts & Sections
 * - Provides detailed AI analysis of applicability
 * - Allows Q&A about specific acts
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
    findRelevantActs,
    chatWithCase,
    type RelevantActsResponse,
    type ChatMessage
} from "./api/legalResearcher";

interface ActsAnalysisPanelProps {
    caseId: number;
    caseType: string;
    caseDescription: string;
    clientName: string;
    onClose: () => void;
}

export default function ActsAnalysisPanel({
    caseId,
    caseType,
    caseDescription,
    clientName,
    onClose
}: ActsAnalysisPanelProps) {
    const [loading, setLoading] = useState(true);
    const [analysisData, setAnalysisData] = useState<RelevantActsResponse | null>(null);
    const [error, setError] = useState("");

    // Chat state
    const [chatQuery, setChatQuery] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-run analysis on mount
    useEffect(() => {
        const fetchActs = async () => {
            try {
                setLoading(true);
                const res = await findRelevantActs({
                    case_description: caseDescription,
                    case_type: caseType,
                    dispute_summary: `Case for ${clientName}`
                });

                if (res.success) {
                    setAnalysisData(res);
                } else {
                    setError("Failed to analyze acts.");
                }
            } catch (err) {
                setError("Connection failed. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        if (caseDescription) {
            fetchActs();
        }
    }, [caseDescription, caseType, clientName]);

    // Handle chat
    const handleChat = async () => {
        if (!chatQuery.trim()) return;

        const userMsg: ChatMessage = { role: "user", content: chatQuery };
        setChatHistory(prev => [...prev, userMsg]);
        setChatQuery("");
        setChatLoading(true);

        try {
            // Contextualize query
            const contextQuery = `Regarding the relevant acts and laws for this case: ${userMsg.content}`;

            const res = await chatWithCase({
                case_id: caseId,
                query: contextQuery
            });

            if (res.success && res.response) {
                setChatHistory(prev => [...prev, { role: "assistant", content: res.response || "" }]);
            }
        } catch (err) {
            setChatHistory(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process that question." }]);
        } finally {
            setChatLoading(false);
        }
    };

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white/95 backdrop-blur-xl rounded-xl border border-[#d4b896] shadow-2xl overflow-hidden flex flex-col h-full max-h-[800px]"
        >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#2c1810] to-[#5d4037] p-4 flex items-center justify-between shrink-0">
                <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                    📜 Legislative Analysis & Acts
                </h2>
                {onClose && (
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Content Content - Two Columns */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                {/* Left: Analysis & Acts List */}
                <div className="flex-1 overflow-y-auto p-4 border-r border-[#e5ddd0]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <div className="animate-spin text-[#d4b896] mb-3">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            </div>
                            <p className="text-[#666] animate-pulse">Analyzing applicable laws with Groq AI...</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
                    ) : analysisData ? (
                        <div className="space-y-6">

                            {/* AI Analysis Summary */}
                            <div className="bg-[#fcfbf7] border border-[#f0e6d2] p-4 rounded-lg">
                                <h3 className="text-[#1a1a1a] font-medium mb-2 flex items-center gap-2">
                                    🧠 AI Legal Analysis
                                </h3>
                                <p className="text-sm text-[#444] leading-relaxed whitespace-pre-wrap">
                                    {analysisData.analysis}
                                </p>
                            </div>

                            {/* Primary Acts */}
                            <div>
                                <h3 className="text-[#8c7355] font-semibold uppercase text-xs tracking-wider mb-3">Primary Legislation</h3>
                                <div className="space-y-3">
                                    {analysisData.primary_acts.map((act, idx) => (
                                        <div key={idx} className="bg-white border border-[#d4b896] p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="font-semibold text-[#2c1810]">{act.title}</h4>
                                                {act.year && <span className="bg-[#f0e6d2] text-[#5d4037] text-xs px-2 py-0.5 rounded">{act.year}</span>}
                                            </div>
                                            <p className="text-xs text-[#666] mb-2">{act.category || "Central Act"}</p>

                                            {/* Sections to Cite */}
                                            {analysisData.sections_to_cite.some(s => s.act === act.title) && (
                                                <div className="mt-2 bg-[#f9f9f9] p-2 rounded border border-gray-100">
                                                    <p className="text-xs font-medium text-[#555] mb-1">Key Sections:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {analysisData.sections_to_cite
                                                            .filter(s => s.act === act.title)
                                                            .map((s, sIdx) => (
                                                                <span key={sIdx} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded text-[#333]" title={s.reason}>
                                                                    Sec {s.section}
                                                                </span>
                                                            ))
                                                        }
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Secondary Acts */}
                            {analysisData.secondary_acts.length > 0 && (
                                <div>
                                    <h3 className="text-[#8c7355] font-semibold uppercase text-xs tracking-wider mb-3">Secondary References</h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {analysisData.secondary_acts.map((act, idx) => (
                                            <div key={idx} className="bg-[#f9f9f9] border border-gray-200 p-3 rounded-lg flex justify-between items-center">
                                                <span className="text-sm text-[#444] font-medium">{act.title}</span>
                                                <span className="text-xs text-[#888]">{act.year}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                {/* Right: Q&A Chat */}
                <div className="w-full md:w-1/3 bg-[#faf9f6]/50 flex flex-col border-t md:border-t-0 md:border-l border-[#e5ddd0]">
                    <div className="p-3 bg-[#f0e6d2] border-b border-[#e5ddd0]">
                        <h3 className="font-medium text-[#5d4037] text-sm">💬 Ask about these Acts</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {chatHistory.length === 0 && (
                            <div className="text-center text-[#888] text-sm py-8">
                                <p>Have questions about specific sections or applicability?</p>
                                <p className="mt-1 font-medium text-[#d4b896]">Ask Nyaya below.</p>
                            </div>
                        )}
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-lg p-3 text-sm ${msg.role === "user"
                                    ? "bg-[#5d4037] text-white rounded-br-none"
                                    : "bg-white border border-[#e5ddd0] text-[#333] rounded-bl-none shadow-sm"
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-[#e5ddd0] p-3 rounded-lg rounded-bl-none">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-[#d4b896] rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-[#d4b896] rounded-full animate-bounce delay-100"></div>
                                        <div className="w-2 h-2 bg-[#d4b896] rounded-full animate-bounce delay-200"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="p-3 border-t border-[#e5ddd0] bg-white">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatQuery}
                                onChange={(e) => setChatQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleChat()}
                                placeholder="Ask a question..."
                                className="flex-1 px-3 py-2 border border-[#d4b896] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#5d4037]"
                            />
                            <button
                                onClick={handleChat}
                                disabled={chatLoading || !chatQuery.trim()}
                                className="p-2 bg-[#5d4037] text-white rounded-lg hover:bg-[#4a332d] disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
