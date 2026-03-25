import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Wand2, Save,
    Bold, Italic, List,
    ChevronRight, ChevronLeft
} from 'lucide-react';
import { suggestDrafting, saveDraft, type DraftingResponse, type CaseDetails } from './api/legalResearcher';

function normalizeDraftText(input: string): string {
    if (!input) return "";

    let text = input;

    // Normalize escaped new lines and repeated spacing from model output.
    text = text.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\t/g, " ");

    // Remove markdown emphasis while keeping content.
    text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
    text = text.replace(/\*([^*]+)\*/g, "$1");
    text = text.replace(/__([^_]+)__/g, "$1");
    text = text.replace(/_([^_]+)_/g, "$1");

    // Remove markdown heading markers and block quote markers.
    text = text.replace(/^#{1,6}\s*/gm, "");
    text = text.replace(/^>\s*/gm, "");

    // Convert markdown bullets to clean legal-list style where possible.
    text = text.replace(/^\s*[-*]\s+/gm, "- ");

    // Clean excessive blank lines.
    text = text.replace(/\n{3,}/g, "\n\n");

    return text.trim();
}

interface DraftingAssistantProps {
    cases: CaseDetails[];
    userId: number;
    onBack: () => void;
}

export default function DraftingAssistant({ cases, userId, onBack }: DraftingAssistantProps) {
    const [selectedCaseId, setSelectedCaseId] = useState<number | null>(cases.length > 0 ? cases[0].case_id : null);
    const [content, setContent] = useState("");
    const [instruction, setInstruction] = useState("");
    const [loading, setLoading] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<DraftingResponse | null>(null);
    const [showSidebar, setShowSidebar] = useState(true);

    // Auto-save logic placeholder
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const selectedCase = cases.find(c => c.case_id === selectedCaseId);

    const handleSuggest = async () => {
        if (!selectedCaseId || !instruction.trim()) return;
        setLoading(true);
        try {
            const res = await suggestDrafting({
                case_id: selectedCaseId,
                user_id: userId,
                current_text: content,
                instruction: instruction
            });
            setAiSuggestion(res);
        } catch (e) {
            console.error(e);
            alert("Failed to get suggestion");
        } finally {
            setLoading(false);
        }
    };

    const applySuggestion = () => {
        if (aiSuggestion) {
            const cleaned = normalizeDraftText(aiSuggestion.suggestion);
            setContent(prev => prev + (prev ? "\n\n" : "") + cleaned);
            setAiSuggestion(null);
            setInstruction("");
        }
    };

    const handleSave = async () => {
        // 1. Download locally
        const filename = `Draft_${selectedCase?.client_name || 'Document'}_${new Date().toISOString().split('T')[0]}.txt`;
        const element = document.createElement("a");
        const file = new Blob([content], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = filename;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);

        // 2. Save to Backend
        if (selectedCaseId) {
            try {
                await saveDraft({
                    case_id: selectedCaseId,
                    user_id: userId,
                    filename: filename,
                    content: content
                });
                // Optional: Notify parent or show toast
            } catch (e) {
                console.error("Failed to save to backend", e);
            }
        }

        setLastSaved(new Date());
    };

    const applyFormat = (type: 'bold' | 'italic' | 'list') => {
        const textarea = document.querySelector('textarea');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);
        let newText = "";
        let newCursorPos = end;

        switch (type) {
            case 'bold':
                newText = `**${selectedText}**`;
                newCursorPos += 4;
                break;
            case 'italic':
                newText = `*${selectedText}*`;
                newCursorPos += 2;
                break;
            case 'list':
                newText = `\n- ${selectedText}`;
                newCursorPos += 3;
                break;
        }

        const nextContent = content.substring(0, start) + newText + content.substring(end);
        setContent(nextContent);

        // Restore focus and cursor (approximate)
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    return (
        <div className="flex h-screen bg-[#f5f1e8] overflow-hidden">
            {/* Left Sidebar - Navigation & Case Select */}
            <div className="w-64 bg-[#e5ddd0] border-r border-[#d4b896] flex flex-col">
                <div className="p-4 border-b border-[#d4b896]">
                    <button onClick={onBack} className="flex items-center gap-2 text-[#5d4037] hover:text-[#1a1a1a] mb-4">
                        <ChevronLeft size={20} />
                        Back to Dashboard
                    </button>
                    <h2 className="text-xl font-serif text-[#1a1a1a]">Drafting Desk</h2>
                </div>

                <div className="p-4 flex-1 overflow-y-auto">
                    <label className="block text-sm font-medium text-[#5d4037] mb-2">Select Case Context</label>
                    <select
                        value={selectedCaseId || ""}
                        onChange={(e) => setSelectedCaseId(Number(e.target.value))}
                        className="w-full p-2 rounded border border-[#d4b896] bg-white mb-6"
                    >
                        {cases.map(c => (
                            <option key={c.case_id} value={c.case_id}>{c.client_name}</option>
                        ))}
                    </select>

                    <div className="space-y-4">
                        <div className="bg-white p-3 rounded-lg border border-[#d4b896] shadow-sm">
                            <h3 className="font-medium text-sm mb-1">Writing Style</h3>
                            <p className="text-xs text-[#666]">Harvard Bluebook Citation</p>
                            <div className="mt-2 flex gap-1">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded">Formal</span>
                                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] rounded">Legal</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content - Editor */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Toolbar */}
                <div className="h-14 bg-white border-b border-[#d4b896] flex items-center px-4 justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => applyFormat('bold')} className="p-2 hover:bg-gray-100 rounded" title="Bold"><Bold size={18} /></button>
                        <button onClick={() => applyFormat('italic')} className="p-2 hover:bg-gray-100 rounded" title="Italic"><Italic size={18} /></button>
                        <button onClick={() => applyFormat('list')} className="p-2 hover:bg-gray-100 rounded" title="Bullet List"><List size={18} /></button>
                        <div className="w-px h-6 bg-gray-300 mx-2" />
                        <button onClick={handleSave} className="p-2 hover:bg-gray-100 rounded" title="Save & Download"><Save size={18} /></button>
                        {lastSaved && <span className="text-xs text-gray-500">Saved: {lastSaved.toLocaleTimeString()}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className={`p-2 rounded flex items-center gap-2 text-sm ${showSidebar ? 'bg-[#f97316] text-white' : 'hover:bg-gray-100'}`}
                        >
                            <Wand2 size={18} />
                            AI Assistant
                        </button>
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 p-8 overflow-y-auto bg-[#faf9f6]">
                    <div className="max-w-4xl mx-auto bg-white min-h-[calc(100vh-8rem)] shadow-lg p-12 border border-gray-200 rounded-lg">
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Start drafting your legal document here..."
                            className="w-full h-full min-h-[600px] resize-none focus:outline-none font-serif text-lg leading-relaxed text-[#1a1a1a]"
                            style={{ fontFamily: "'Times New Roman', serif" }}
                        />
                    </div>
                </div>
            </div>

            {/* Right Sidebar - AI Assistant */}
            <AnimatePresence>
                {showSidebar && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 320, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="bg-white border-l border-[#d4b896] shadow-xl flex flex-col"
                    >
                        <div className="p-4 bg-[#f5e6c8] border-b border-[#d4b896] flex justify-between items-center">
                            <h3 className="font-medium text-[#1a1a1a] flex items-center gap-2">
                                <Wand2 size={18} className="text-[#f97316]" />
                                AI Drafter
                            </h3>
                            <button onClick={() => setShowSidebar(false)} className="text-[#666] hover:text-[#1a1a1a]"><ChevronRight size={18} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Instruction Input */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-[#666] uppercase">Instruction</label>
                                <textarea
                                    value={instruction}
                                    onChange={(e) => setInstruction(e.target.value)}
                                    placeholder="E.g., Draft a confidentiality clause..."
                                    className="w-full p-2 rounded border border-[#d4b896] text-sm focus:ring-1 focus:ring-[#f97316]"
                                    rows={3}
                                />
                                <button
                                    onClick={handleSuggest}
                                    disabled={loading || !instruction.trim()}
                                    className="w-full py-2 bg-[#1a3a5c] text-white rounded text-sm font-medium hover:bg-[#2c4a6e] disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {loading ? "Generating..." : "Generate Suggestion"}
                                </button>
                            </div>

                            {/* Suggestion Result */}
                            {aiSuggestion && (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-green-600">SUGGESTION</span>
                                        <button onClick={() => setAiSuggestion(null)} className="text-gray-400 hover:text-gray-600">×</button>
                                    </div>
                                    <p className="text-sm font-serif italic text-gray-800 bg-white p-2 border rounded whitespace-pre-wrap border-l-4 border-l-[#f97316]">
                                        {normalizeDraftText(aiSuggestion.suggestion)}
                                    </p>

                                    {aiSuggestion.reasoning && (
                                        <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded border border-yellow-100">
                                            <strong>Reasoning:</strong> {aiSuggestion.reasoning}
                                        </div>
                                    )}

                                    <button
                                        onClick={applySuggestion}
                                        className="w-full py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 flex items-center justify-center gap-1"
                                    >
                                        <ChevronLeft size={14} /> Insert into Document
                                    </button>
                                </div>
                            )}

                            {/* Context Info */}
                            <div className="pt-4 border-t border-dashed border-gray-300">
                                <h4 className="text-xs font-bold text-[#666] uppercase mb-2">Context</h4>
                                {selectedCase ? (
                                    <div className="bg-[#f9fafb] p-3 rounded border border-gray-200 text-xs text-gray-600 space-y-1">
                                        <p><strong>Client:</strong> {selectedCase.client_name}</p>
                                        <p><strong>Type:</strong> {selectedCase.case_type}</p>
                                        <p><strong>Evidence:</strong> {selectedCase.key_evidence_list?.length || 0} items</p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-red-500">Please select a case.</p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
