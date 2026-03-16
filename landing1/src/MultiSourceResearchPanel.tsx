/**
 * MultiSourceResearchPanel - US/UK Case Law & Acts Search UI
 * 
 * Features:
 * - Tabbed interface for different research sources
 * - Search US federal court cases (GovInfo)
 * - Search UK case law (National Archives)
 * - Search Indian acts (IndiaCode)
 * - Display results with links to full documents
 * - Stores all searches for later retrieval
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    searchActs,
    searchInternationalCases,
    type ActResult,
    type InternationalCase,
} from "./api/legalResearcher";

interface MultiSourceResearchPanelProps {
    caseType?: string;
    caseDescription?: string;
    initialTab?: "acts" | "us";
    onClose?: () => void;
}

type ResearchTab = "acts" | "us";

export default function MultiSourceResearchPanel({
    caseType = "",
    // caseDescription is available for future auto-search on mount
    initialTab = "acts",
    onClose,
}: MultiSourceResearchPanelProps) {
    const [activeTab, setActiveTab] = useState<ResearchTab>(initialTab);
    const [searchQuery, setSearchQuery] = useState(caseType || "");
    const [loading, setLoading] = useState(false);

    // Results state
    const [actsResults, setActsResults] = useState<ActResult[]>([]);
    const [usResults, setUsResults] = useState<InternationalCase[]>([]);
    const [error, setError] = useState("");

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setLoading(true);
        setError("");

        try {
            if (activeTab === "acts") {
                const res = await searchActs({ query: searchQuery, max_results: 10 });
                if (res.success) {
                    setActsResults(res.results);
                } else {
                    setError("Failed to search acts");
                }
            } else if (activeTab === "us") {
                const res = await searchInternationalCases({
                    query: searchQuery,
                    jurisdictions: ["US"],
                    max_results: 10,
                });
                if (res.success) {
                    setUsResults(res.us_cases as InternationalCase[]);
                } else {
                    setError("Failed to search US cases");
                }
            }
        } catch (err) {
            setError("Search failed. Please try again.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: "acts" as const, label: "📚 Acts & Laws", emoji: "🇮🇳" },
        { id: "us" as const, label: "🇺🇸 US Case Law", emoji: "🇺🇸" },
    ];

    return (
        <div className="bg-white/95 backdrop-blur-xl rounded-xl border border-[#d4b896] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1a3a5c] to-[#2d5a87] p-4 flex items-center justify-between">
                <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                    🌐 Multi-Source Legal Research
                </h2>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-[#e5ddd0]">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-3 px-4 text-sm font-medium transition-all ${activeTab === tab.id
                            ? "bg-[#f5e6c8] text-[#1a1a1a] border-b-2 border-[#f97316]"
                            : "text-[#666] hover:bg-[#f5f1e8]/50"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search Bar */}
            <div className="p-4 bg-[#f5f1e8]/50">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder={
                            activeTab === "acts"
                                ? "Search for acts, e.g., 'property transfer', 'contract'..."
                                : activeTab === "us"
                                    ? "Search US federal court opinions..."
                                    : "Search UK court judgments..."
                        }
                        className="flex-1 px-4 py-2.5 rounded-lg border border-[#d4b896] bg-white focus:outline-none focus:ring-2 focus:ring-[#f97316] text-[#1a1a1a]"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={loading || !searchQuery.trim()}
                        className="px-6 py-2.5 bg-[#f97316] text-white font-medium rounded-lg hover:bg-[#ea580c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Searching...
                            </>
                        ) : (
                            <>🔍 Search</>
                        )}
                    </button>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Results Area */}
            <div className="p-4 max-h-[500px] overflow-y-auto">
                <AnimatePresence mode="wait">
                    {/* Acts Results */}
                    {activeTab === "acts" && (
                        <motion.div
                            key="acts"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-3"
                        >
                            {actsResults.length === 0 ? (
                                <div className="text-center py-12 text-[#666]">
                                    <div className="text-4xl mb-3">📚</div>
                                    <p>Search for Indian acts and legislation</p>
                                    <p className="text-sm mt-1">E.g., "property transfer", "criminal procedure", "contract"</p>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm text-[#666] mb-3">Found {actsResults.length} acts</p>
                                    {actsResults.map((act, idx) => (
                                        <div key={act.act_id || idx} className="bg-[#f5f1e8] p-4 rounded-lg border border-[#d4b896] hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-semibold text-[#1a1a1a] flex-1">{act.title}</h4>
                                                <span className={`text-xs px-2 py-1 rounded-full ${act.status === "In Force" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                                    {act.status}
                                                </span>
                                            </div>
                                            <div className="flex gap-4 text-xs text-[#666] mb-2">
                                                <span>📅 {act.year}</span>
                                                <span>📋 {act.act_number}</span>
                                                <span>🏛️ {act.category}</span>
                                            </div>
                                            {act.full_text_url && (
                                                <a
                                                    href={act.full_text_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline text-sm inline-flex items-center gap-1"
                                                >
                                                    View Full Act →
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* US Case Law Results */}
                    {activeTab === "us" && (
                        <motion.div
                            key="us"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-3"
                        >
                            {usResults.length === 0 ? (
                                <div className="text-center py-12 text-[#666]">
                                    <div className="text-4xl mb-3">🇺🇸</div>
                                    <p>Search US Federal Court Opinions</p>
                                    <p className="text-sm mt-1">Powered by GovInfo API</p>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm text-[#666] mb-3">Found {usResults.length} US cases</p>
                                    {usResults.map((caseItem, idx) => (
                                        <div key={idx} className="bg-[#f5f1e8] p-4 rounded-lg border border-[#d4b896] hover:shadow-md transition-shadow">
                                            <h4 className="font-semibold text-[#1a1a1a] mb-2">{caseItem.case_title}</h4>
                                            <div className="flex gap-4 text-xs text-[#666] mb-2">
                                                {caseItem.court && <span>🏛️ {caseItem.court}</span>}
                                                {caseItem.date && <span>📅 {caseItem.date}</span>}
                                                {caseItem.citation && <span>📝 {caseItem.citation}</span>}
                                            </div>
                                            {caseItem.summary && (
                                                <p className="text-sm text-[#444] mb-2 line-clamp-3">{caseItem.summary}</p>
                                            )}
                                            {caseItem.full_text_url && (
                                                <a
                                                    href={caseItem.full_text_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline text-sm inline-flex items-center gap-1"
                                                >
                                                    View Full Case →
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
