import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "./LanguageContext";
import MultiSourceResearchPanel from "./MultiSourceResearchPanel";
import EvidencePanel from "./EvidencePanel";
import ActsAnalysisPanel from "./ActsAnalysisPanel";
import DraftingAssistant from "./DraftingAssistant";
import {
  getUserCases,
  createCaseManual,
  createCaseAI,
  uploadCasePDF,
  getCase,
  deleteCase,
  chatWithCase,
  getChatHistory,
  getChatSummary,
  conductResearch,
  exportCasePDF,
  getUserStats,

  updateCaseProgress,
  searchKanoon,
  importKanoonDocument,
  uploadEvidence,
  getCaseResearchHistory,
  runAgentAsync,
  getAgentRunStatus,
  getAgentHistory,
  startGoogleAuth,
  type CaseDetails,
  type ChatMessage,
  type ResearchResult,
  type KanoonSearchResult,
  type AgentRunResponse,
  type FormattedCaseOutput,
  type AgentRunStatusResponse,
  type AgentLogEntry,
  type AgentHistoryItem,
} from "./api/legalResearcher";

// ==================== CREATE CASE MODAL ====================
interface CreateCaseModalProps {
  onClose: () => void;
  onCaseCreated: () => void;
}

const DEFAULT_USER_ID = 1; // Default user ID for demo purposes

function cleanDisplayText(input?: string): string {
  if (!input) return "";
  let text = String(input);
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");
  text = text.replace(/\\\\/g, " ");
  text = text.replace(/\\\[/g, "[").replace(/\\\]/g, "]");
  text = text.replace(/\\\(/g, "(").replace(/\\\)/g, ")");
  text = text.replace(/\\-/g, "-").replace(/\\#/g, "#").replace(/\\\./g, ".");
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^[-*+]\s+/gm, "");
  text = text.replace(/^>\s*/gm, "");
  text = text.replace(/^\d+[.)]\s+/gm, "");
  text = text.replace(/```/g, "");
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function fallbackFormattedFromResearchCase(caseInfo: {
  title?: string;
  url?: string;
  snippet?: string;
  court?: string;
  date?: string;
  case_type?: string;
  verdict?: string;
  ai_summary?: string;
}): FormattedCaseOutput {
  const title = caseInfo.title || "Case Output";
  return {
    title,
    source: "research",
    details: [
      `Title: ${title}`,
      `Court: ${caseInfo.court || "Not specified"}`,
      `Date: ${caseInfo.date || "Not specified"}`,
      `Case Type: ${caseInfo.case_type || "Not specified"}`,
      `Reference URL: ${caseInfo.url || "Not available"}`,
    ],
    judgement: caseInfo.verdict || "Judgement details not explicitly available.",
    summary: caseInfo.snippet || "No summary available.",
    key_points: [
      caseInfo.verdict ? `Outcome signal: ${caseInfo.verdict}` : "Outcome signal not clearly available.",
      caseInfo.court ? `Forum: ${caseInfo.court}` : "Forum not specified.",
      caseInfo.date ? `Date marker: ${caseInfo.date}` : "Date not specified.",
    ],
    ai_message: caseInfo.ai_summary || caseInfo.snippet || "No AI message available.",
    other_sections: [],
  };
}

function fallbackFormattedFromAgentState(state: any): FormattedCaseOutput[] {
  const researchResults = Array.isArray(state?.research_results) ? state.research_results : [];
  if (researchResults.length > 0) {
    return researchResults.map((item: any, idx: number) => {
      const title = item?.case_title || item?.title || `Research Case ${idx + 1}`;
      return {
        title,
        source: "agent_research",
        details: [
          `Title: ${title}`,
          `Reference URL: ${item?.url || "Not available"}`,
        ],
        judgement: item?.verdict || state?.stop_reason || "Judgement details not explicitly available.",
        summary: item?.summary || "No summary available.",
        key_points: [
          item?.summary ? `Summary insight: ${String(item.summary).slice(0, 160)}${String(item.summary).length > 160 ? "..." : ""}` : "No summarized research insight available.",
        ],
        ai_message: item?.summary || state?.last_message || "No AI message available.",
        other_sections: [],
      };
    });
  }

  const aiMessage = state?.last_message || "No synthesized message available.";
  return [
    {
      title: "Agent Output",
      source: "agent_output",
      details: [
        `Run ID: ${state?.run_id || "unknown"}`,
        `Status: ${state?.stop_reason || "completed"}`,
      ],
      judgement: state?.stop_reason || "completed",
      summary: aiMessage,
      key_points: [
        `Agent stop reason: ${state?.stop_reason || "completed"}`,
      ],
      ai_message: aiMessage,
      other_sections: [],
    },
  ];
}

function ExpandableCaseOutputs({
  items,
  emptyText,
}: {
  items: FormattedCaseOutput[];
  emptyText: string;
}) {
  const getPreview = (item: FormattedCaseOutput): string => {
    const candidate = cleanDisplayText(item.summary) || cleanDisplayText(item.ai_message) || cleanDisplayText(item.judgement);
    if (!candidate) return "No summary available.";
    return candidate.length > 90 ? `${candidate.slice(0, 90)}...` : candidate;
  };

  const getSourceLabel = (source?: string): string => {
    if (!source) return "Research";
    return source
      .replace(/_/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
  };

  if (!items || items.length === 0) {
    return <p className="text-sm text-[#666]">{emptyText}</p>;
  }

  return (
    <div className="rounded-2xl border border-[#e3d7bf] bg-[#efe6d1] p-4 md:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-[#5d4037]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
        <h4 className="text-lg font-semibold text-[#3b3128]">Research Documents</h4>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {items.map((item, idx) => (
          <div key={`${item.title || "case"}-${idx}`} className="rounded-xl border border-[#ddd4c5] bg-[#f8f5ee] shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <div className="p-4 flex items-start gap-3">
              <div className="h-12 w-12 rounded-lg bg-[#ece8de] flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-[#ea7b2b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v6h6" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[1.05rem] font-semibold text-[#242424] truncate">{cleanDisplayText(item.title) || `Case ${idx + 1}`}</p>
                <p className="text-sm text-[#6a6a6a] truncate">PDF | {getPreview(item)}</p>
              </div>

              <div className="text-xs text-[#8a8a8a] text-right shrink-0 ml-2">
                <p>{getSourceLabel(item.source)}</p>
                <p className="mt-1 text-[#a2885a]">{idx + 1}</p>
              </div>
            </div>

            <div className="px-4 pb-4 pt-2 border-t border-[#e9e1d3] text-sm space-y-3">
              <section className="bg-[#f3eee2] rounded p-3">
                <p className="text-[#5d4037] font-semibold mb-2">Details</p>
                <ul className="mt-2 list-disc list-inside text-[#1a1a1a] space-y-1">
                  {(item.details || ["No details available."]).map((line, i) => (
                    <li key={i}>{cleanDisplayText(line) || "No details available."}</li>
                  ))}
                </ul>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <section className="bg-[#f3eee2] rounded p-3">
                  <p className="text-[#5d4037] font-semibold mb-2">Judgement</p>
                  <p className="text-[#1a1a1a] whitespace-pre-wrap">{cleanDisplayText(item.judgement) || "Judgement details not available."}</p>
                </section>

                <section className="bg-[#f3eee2] rounded p-3">
                  <p className="text-[#5d4037] font-semibold mb-2">Summary</p>
                  <p className="text-[#1a1a1a] whitespace-pre-wrap">{cleanDisplayText(item.summary) || "No summary available."}</p>
                </section>
              </div>

              <section className="bg-[#f3eee2] rounded p-3">
                <p className="text-[#5d4037] font-semibold mb-2">Key Points</p>
                <ul className="mt-2 list-disc list-inside text-[#1a1a1a] space-y-1">
                  {(item.key_points || ["No key points available."]).map((point, i) => (
                    <li key={i}>{cleanDisplayText(point) || "No key points available."}</li>
                  ))}
                </ul>
              </section>

              <section className="bg-[#f3eee2] rounded p-3">
                <p className="text-[#5d4037] font-semibold mb-2">AI Message</p>
                <p className="text-[#1a1a1a] whitespace-pre-wrap">{cleanDisplayText(item.ai_message) || "No AI message available."}</p>
              </section>

              <section className="bg-[#f3eee2] rounded p-3">
                <p className="text-[#5d4037] font-semibold mb-2">Other Important Sections</p>
                {item.other_sections && item.other_sections.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {item.other_sections.map((section, i) => (
                      <div key={i} className="border border-[#ece6d9] rounded p-2 bg-white">
                        <p className="text-xs font-medium text-[#5d4037]">{cleanDisplayText(section.title)}</p>
                        <p className="text-sm text-[#1a1a1a] whitespace-pre-wrap">{cleanDisplayText(section.content)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[#666]">No additional sections available.</p>
                )}
              </section>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateCaseModal({ onClose, onCaseCreated }: CreateCaseModalProps) {
  const [tab, setTab] = useState<"manual" | "ai" | "pdf">("manual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Manual form fields - matching backend ManualCaseCreate model
  const [clientName, setClientName] = useState("");
  const [opposingParty, setOpposingParty] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [caseType, setCaseType] = useState("");
  const [legalIssueSummary, setLegalIssueSummary] = useState("");
  const [keyEvidence, setKeyEvidence] = useState("");
  const [applicableLaws, setApplicableLaws] = useState("");
  const [recommendedActions, _setRecommendedActions] = useState("");

  // AI extraction
  const [rawNotes, setRawNotes] = useState("");

  // PDF upload
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // Evidence upload
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setError("Client name is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await createCaseManual(DEFAULT_USER_ID, {
        client_name: clientName,
        opposing_party: opposingParty || undefined,
        incident_date: incidentDate || undefined,
        case_type: caseType || undefined,
        legal_issue_summary: legalIssueSummary || undefined,
        key_evidence_list: keyEvidence ? keyEvidence.split('\n').filter(e => e.trim()) : undefined,
        applicable_laws: applicableLaws ? applicableLaws.split('\n').filter(l => l.trim()) : undefined,
        recommended_actions: recommendedActions ? recommendedActions.split('\n').filter(a => a.trim()) : undefined,
      });
      if (res.success) {
        if (evidenceFile && res.case_id) {
          try {
            await uploadEvidence(res.case_id, evidenceFile, "Initial Evidence from creation", DEFAULT_USER_ID);
          } catch (e) {
            console.error("Failed to upload evidence during creation", e);
            // Verify if we should alert user? Maybe just log.
          }
        }
        onCaseCreated();
        onClose();
      } else {
        setError(res.message || "Failed to create case");
      }
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawNotes.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await createCaseAI(DEFAULT_USER_ID, { raw_notes: rawNotes });
      if (res.success) {
        onCaseCreated();
        onClose();
      } else {
        setError(res.message || "AI extraction failed");
      }
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePDFSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) return;
    setLoading(true);
    setError("");
    try {
      const res = await uploadCasePDF(DEFAULT_USER_ID, pdfFile);
      if (res.success) {
        onCaseCreated();
        onClose();
      } else {
        setError(res.message || "PDF upload failed");
      }
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#f5f1e8] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-[#d4b896]"
      >
        <div className="p-6 border-b border-[#d4b896] flex justify-between items-center">
          <h2 className="text-[24px] font-normal text-[#1a1a1a]" style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}>
            Create New Case
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[#e5ddd0] rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-[#d4b896]">
          <button
            onClick={() => setTab("manual")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === "manual" ? "bg-[#e5ddd0] text-[#1a1a1a] border-b-2 border-[#f97316]" : "text-[#666] hover:bg-[#e5ddd0]/50"}`}
          >
            📝 Manual Entry
          </button>
          <button
            onClick={() => setTab("ai")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === "ai" ? "bg-[#e5ddd0] text-[#1a1a1a] border-b-2 border-[#f97316]" : "text-[#666] hover:bg-[#e5ddd0]/50"}`}
          >
            🤖 AI Extract
          </button>
          <button
            onClick={() => setTab("pdf")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === "pdf" ? "bg-[#e5ddd0] text-[#1a1a1a] border-b-2 border-[#f97316]" : "text-[#666] hover:bg-[#e5ddd0]/50"}`}
          >
            📄 Upload PDF
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {tab === "manual" && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Client Name *</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g., John Doe"
                    className="w-full px-4 py-2 rounded-lg border border-[#d4b896] bg-white focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Opposing Party</label>
                  <input
                    type="text"
                    value={opposingParty}
                    onChange={(e) => setOpposingParty(e.target.value)}
                    placeholder="e.g., ABC Corporation"
                    className="w-full px-4 py-2 rounded-lg border border-[#d4b896] bg-white focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Incident Date</label>
                  <input
                    type="date"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-[#d4b896] bg-white focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Case Type</label>
                  <select
                    value={caseType}
                    onChange={(e) => setCaseType(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-[#d4b896] bg-white focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                  >
                    <option value="">Select type</option>
                    <option value="Civil">Civil</option>
                    <option value="Criminal">Criminal</option>
                    <option value="Constitutional">Constitutional</option>
                    <option value="Corporate">Corporate</option>
                    <option value="Family">Family</option>
                    <option value="Property">Property</option>
                    <option value="Tax">Tax</option>
                    <option value="Contract">Contract Dispute</option>
                    <option value="Employment">Employment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Legal Issue Summary</label>
                  <textarea
                    value={legalIssueSummary}
                    onChange={(e) => setLegalIssueSummary(e.target.value)}
                    rows={3}
                    placeholder="Describe the main legal issue..."
                    className="w-full px-4 py-2 rounded-lg border border-[#d4b896] bg-white focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Key Evidence (one per line)</label>
                  <textarea
                    value={keyEvidence}
                    onChange={(e) => setKeyEvidence(e.target.value)}
                    rows={3}
                    placeholder="Contract dated 15th March 2024&#10;Email correspondence&#10;Bank statements"
                    className="w-full px-4 py-2 rounded-lg border border-[#d4b896] bg-white focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Upload Evidence (Initial)</label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-[#666] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#e5ddd0] file:text-[#5d4037] hover:file:bg-[#d4b896]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Applicable Laws (one per line)</label>
                  <textarea
                    value={applicableLaws}
                    onChange={(e) => setApplicableLaws(e.target.value)}
                    rows={2}
                    placeholder="Indian Contract Act, 1872&#10;Specific Relief Act, 1963"
                    className="w-full px-4 py-2 rounded-lg border border-[#d4b896] bg-white focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#f97316] text-white font-medium rounded-lg hover:bg-[#ea580c] transition-colors disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Case"}
              </button>
            </form>
          )}

          {tab === "ai" && (
            <form onSubmit={handleAISubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Paste your case notes, client information, or any raw text
                </label>
                <p className="text-xs text-[#666] mb-3">
                  Our AI will automatically extract case details including parties, incident dates, legal issues, evidence, and recommended actions.
                </p>
                <textarea
                  value={rawNotes}
                  onChange={(e) => setRawNotes(e.target.value)}
                  rows={12}
                  placeholder="E.g., Met with client John Smith today. He wants to file a case against ABC Corp for breach of contract. The contract was signed on 15th March 2024. Client claims ABC Corp failed to deliver goods worth Rs. 50 lakhs. We have the original contract, email exchanges, and delivery receipts as evidence..."
                  className="w-full px-4 py-3 rounded-lg border border-[#d4b896] bg-white focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || !rawNotes.trim()}
                className="w-full py-3 bg-[#f97316] text-white font-medium rounded-lg hover:bg-[#ea580c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    AI is analyzing...
                  </>
                ) : (
                  <>🤖 Extract Case Details</>
                )}
              </button>
            </form>
          )}

          {tab === "pdf" && (
            <form onSubmit={handlePDFSubmit} className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${pdfFile ? "border-green-500 bg-green-50" : "border-[#d4b896] hover:border-[#f97316]"}`}
              >
                {pdfFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-left">
                      <p className="font-medium text-[#1a1a1a]">{pdfFile.name}</p>
                      <p className="text-sm text-[#666]">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPdfFile(null)}
                      className="ml-4 p-2 hover:bg-red-100 rounded-lg"
                    >
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <svg className="w-12 h-12 mx-auto text-[#d4b896] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <label className="cursor-pointer">
                      <span className="text-[#1a1a1a] font-medium">Click to upload</span> or drag and drop
                      <p className="text-sm text-[#666] mt-1">PDF files up to 10MB</p>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                  </>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !pdfFile}
                className="w-full py-3 bg-[#f97316] text-white font-medium rounded-lg hover:bg-[#ea580c] transition-colors disabled:opacity-50"
              >
                {loading ? "Uploading & Analyzing..." : "Upload & Extract Case"}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ==================== CASE DETAIL VIEW ====================
interface CaseDetailProps {
  caseData: CaseDetails;
  onBack: () => void;
  onDelete: (id: number) => void;
  onRefresh?: () => void;
}

function CaseDetailView({ caseData, onBack, onDelete, onRefresh }: CaseDetailProps) {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [showResearch, setShowResearch] = useState(false);
  const [showMultiSource, setShowMultiSource] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showActs, setShowActs] = useState(false);
  const [showAgent, setShowAgent] = useState(false);
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
  const [researching, setResearching] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Progress tracking state
  const [progress, setProgress] = useState(caseData.progress || 0);
  const [stage, setStage] = useState(caseData.stage || "");
  const [savingProgress, setSavingProgress] = useState(false);
  const [progressSaved, setProgressSaved] = useState(false);

  // Doc Search State
  const [showDocSearch, setShowDocSearch] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [docSearchResults, setDocSearchResults] = useState<KanoonSearchResult[]>([]);
  const [searchingDocs, setSearchingDocs] = useState(false);
  const [importingDoc, setImportingDoc] = useState(false);

  // Agent state
  const [agentInstruction, setAgentInstruction] = useState("");
  const [runningAgent, setRunningAgent] = useState(false);
  const [agentError, setAgentError] = useState("");
  const [agentResult, setAgentResult] = useState<AgentRunResponse | null>(null);
  const [agentLiveLogs, setAgentLiveLogs] = useState<AgentLogEntry[]>([]);
  const [agentRunStatus, setAgentRunStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [agentHistory, setAgentHistory] = useState<AgentHistoryItem[]>([]);
  const [loadingAgentHistory, setLoadingAgentHistory] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const currentAgentLogs: AgentLogEntry[] = runningAgent ? agentLiveLogs : (agentResult?.logs || []);
  const latestRunFormattedCases: FormattedCaseOutput[] =
    (agentResult?.formatted_cases && agentResult.formatted_cases.length > 0)
      ? agentResult.formatted_cases
      : (agentResult ? fallbackFormattedFromAgentState({ ...agentResult, run_id: agentResult.run_id, last_message: agentResult.last_message }) : []);

  const handleDocSearch = async () => {
    if (!docSearchQuery.trim()) return;
    setSearchingDocs(true);
    setDocSearchResults([]);
    try {
      const res = await searchKanoon(docSearchQuery);
      setDocSearchResults(res.results);
    } catch (e) {
      console.error(e);
    } finally {
      setSearchingDocs(false);
    }
  };

  const handleImportDoc = async (res: KanoonSearchResult) => {
    setImportingDoc(true);
    try {
      await importKanoonDocument(caseData.case_id, res.url, res.title);
      alert("Document successfully imported!");
      setShowDocSearch(false);
      if (onRefresh) onRefresh();
    } catch (e) {
      alert("Failed to import document.");
      console.error(e);
    } finally {
      setImportingDoc(false);
    }
  };

  const loadResearchHistory = async () => {
    try {
      const res = await getCaseResearchHistory(caseData.case_id, DEFAULT_USER_ID);
      if (res.success && res.history && res.history.length > 0) {
        const latest = res.history[0];
        if (latest.results) {
          setResearchResult(latest.results);
        }
      }
    } catch (e) {
      console.error("Failed to load research history", e);
    }
  };

  const loadAgentHistory = async () => {
    setLoadingAgentHistory(true);
    try {
      const rows = await getAgentHistory(caseData.case_id, DEFAULT_USER_ID);
      setAgentHistory(rows);
    } catch (e) {
      console.error("Failed to load agent history", e);
    } finally {
      setLoadingAgentHistory(false);
    }
  };

  const loadChatHistory = async () => {
    try {
      const res = await getChatHistory(caseData.case_id);
      if (res.success) {
        setMessages(res.messages);
      }
    } catch (err) {
      console.error("Failed to load chat history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await getChatSummary(caseData.case_id);
      if (res.success && res.summary) {
        setSummary(res.summary);
      }
    } catch (err) {
      console.error("Failed to load summary", err);
    }
  };

  useEffect(() => {
    loadChatHistory();
    loadSummary();
    loadResearchHistory();
    loadAgentHistory();
  }, [caseData.case_id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await chatWithCase({ case_id: caseData.case_id, query: userMsg, language: language });
      if (res.success && res.response) {
        setMessages((prev) => [...prev, { role: "assistant", content: res.response! }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: res.message || "Sorry, I couldn't process your request." }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection failed. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleResearch = async () => {
    setResearching(true);
    try {
      const res = await conductResearch({
        client_name: caseData.client_name,
        case_title: `${caseData.client_name} vs ${caseData.opposing_party || 'Unknown'}`,
        description: caseData.legal_issue_summary || caseData.raw_description || "Legal case research",
      });
      if (res.success && res.research) {
        setResearchResult(res.research);
      }
    } catch (err) {
      console.error("Research failed", err);
    } finally {
      setResearching(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportCasePDF(caseData.case_id, DEFAULT_USER_ID);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `case_${caseData.case_id}_${caseData.client_name.replace(/\s+/g, '_')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  const handleSaveProgress = async () => {
    setSavingProgress(true);
    setProgressSaved(false);
    try {
      await updateCaseProgress(caseData.case_id, {
        user_id: DEFAULT_USER_ID,
        progress,
        stage,
      });
      setProgressSaved(true);
      setTimeout(() => setProgressSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save progress", err);
    } finally {
      setSavingProgress(false);
    }
  };

  const handleRunAgent = async () => {
    setRunningAgent(true);
    setAgentError("");
    setAgentResult(null);
    setAgentLiveLogs([]);
    setAgentRunStatus("running");
    setActiveRunId(null);
    try {
      const started = await runAgentAsync(caseData.case_id, DEFAULT_USER_ID, agentInstruction.trim() || undefined);
      setActiveRunId(started.run_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to run agent";
      setAgentError(message);
      setRunningAgent(false);
      setAgentRunStatus("failed");
    }
  };

  useEffect(() => {
    if (!runningAgent || !activeRunId) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const status: AgentRunStatusResponse = await getAgentRunStatus(activeRunId, DEFAULT_USER_ID);
        if (cancelled) return;

        setAgentRunStatus(status.status);
        setAgentLiveLogs(status.logs || []);

        if (status.status === "completed") {
          setAgentResult(status);
          setRunningAgent(false);
          setActiveRunId(null);
          await loadAgentHistory();
          return;
        }

        if (status.status === "failed") {
          setAgentResult(status);
          setRunningAgent(false);
          setActiveRunId(null);
          setAgentError(status.stop_reason ? `Agent failed: ${status.stop_reason}` : "Agent run failed");
          await loadAgentHistory();
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to poll agent status";
        setAgentError(message);
        setRunningAgent(false);
        setActiveRunId(null);
        setAgentRunStatus("failed");
      }
    };

    poll();
    const timer = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [runningAgent, activeRunId, caseData.case_id]);

  const handleConnectGoogle = async () => {
    setAgentError("");
    try {
      const apiRoot = (import.meta.env.VITE_API_URL || "http://localhost:8000/legal").replace(/\/legal\/?$/, "");
      const redirectUri = `${apiRoot}/legal/agent/auth/google/callback`;
      const res = await startGoogleAuth(redirectUri, DEFAULT_USER_ID);
      if (!res.auth_url) {
        throw new Error("No Google auth URL returned");
      }
      window.location.href = res.auth_url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start Google authorization";
      setAgentError(message);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-[#666] hover:text-[#1a1a1a] transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Cases
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowResearch(!showResearch); setShowMultiSource(false); setShowEvidence(false); setShowActs(false); if (!showResearch && !researchResult) handleResearch(); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showResearch ? "bg-[#f97316] text-white" : "bg-[#e5ddd0] text-[#666] hover:bg-[#d4c4a8]"}`}
          >
            🔍 Indian Cases
          </button>
          <button
            onClick={() => { setShowMultiSource(!showMultiSource); setShowResearch(false); setShowEvidence(false); setShowActs(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showMultiSource ? "bg-[#1a3a5c] text-white" : "bg-[#e5ddd0] text-[#666] hover:bg-[#d4c4a8]"}`}
          >
            🌐 US Cases
          </button>
          <button
            onClick={() => { setShowActs(!showActs); setShowResearch(false); setShowMultiSource(false); setShowEvidence(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showActs ? "bg-[#5d4037] text-white" : "bg-[#e5ddd0] text-[#666] hover:bg-[#d4c4a8]"}`}
          >
            📜 Acts
          </button>
          <button
            onClick={() => { setShowAgent(!showAgent); setShowResearch(false); setShowMultiSource(false); setShowEvidence(false); setShowActs(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showAgent ? "bg-[#0f766e] text-white" : "bg-[#e5ddd0] text-[#666] hover:bg-[#d4c4a8]"}`}
          >
            🤖 Agent
          </button>
          <button
            onClick={() => { setShowEvidence(!showEvidence); setShowResearch(false); setShowMultiSource(false); setShowActs(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showEvidence ? "bg-purple-600 text-white" : "bg-[#e5ddd0] text-[#666] hover:bg-[#d4c4a8]"}`}
          >
            🔬 Evidence
          </button>
          <button onClick={handleExport} className="px-4 py-2 bg-[#e5ddd0] text-[#666] hover:bg-[#d4c4a8] rounded-lg text-sm font-medium transition-colors">
            📄 Export PDF
          </button>
          <button
            onClick={() => onDelete(caseData.case_id)}
            className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors"
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Case Details Panel */}
        <div className="lg:col-span-1 bg-[#f5e6c8]/80 rounded-xl p-6 border border-[#d4b896]/50 overflow-y-auto">
          <h2 className="text-[20px] font-normal text-[#1a1a1a] mb-4" style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}>
            {caseData.client_name} {caseData.opposing_party && `vs ${caseData.opposing_party}`}
          </h2>

          <div className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-[#666]">Client Name</span>
              <span className="font-medium text-[#1a1a1a]">{caseData.client_name}</span>
            </div>
            {caseData.opposing_party && (
              <div className="flex justify-between">
                <span className="text-[#666]">Opposing Party</span>
                <span className="font-medium text-[#1a1a1a]">{caseData.opposing_party}</span>
              </div>
            )}
            {caseData.incident_date && (
              <div className="flex justify-between">
                <span className="text-[#666]">Incident Date</span>
                <span className="font-medium text-[#1a1a1a]">{caseData.incident_date}</span>
              </div>
            )}
            {caseData.case_type && (
              <div className="flex justify-between">
                <span className="text-[#666]">Case Type</span>
                <span className="font-medium text-[#1a1a1a]">{caseData.case_type}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#666]">Created</span>
              <span className="font-medium text-[#1a1a1a]">{new Date(caseData.created_at).toLocaleDateString()}</span>
            </div>

            {/* Progress Section */}
            <hr className="border-[#d4b896]/50" />
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[#666]">Progress</span>
                {stage.toLowerCase() === 'complete' && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">✓ Complete</span>
                )}
              </div>

              {/* Progress Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-[#666]">
                  <span>0%</span>
                  <span className="font-medium text-[#f97316]">{progress}%</span>
                  <span>100%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={progress}
                  onChange={(e) => setProgress(parseInt(e.target.value))}
                  className="w-full h-2 bg-[#e5ddd0] rounded-lg appearance-none cursor-pointer accent-[#f97316]"
                />
                <div className="h-2 bg-[#e5ddd0] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#f97316] to-[#ea580c] rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Stage Input */}
              <div className="space-y-1">
                <span className="text-[#666] text-xs">Stage (filing / trial / appeal / complete)</span>
                <input
                  type="text"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  placeholder="e.g. filing, trial, appeal, complete"
                  className="w-full px-3 py-2 bg-white/50 border border-[#d4b896] rounded-lg text-sm text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#f97316]/50"
                />
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveProgress}
                disabled={savingProgress}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${progressSaved
                  ? "bg-green-500 text-white"
                  : savingProgress
                    ? "bg-[#d4c4a8] text-[#666] cursor-wait"
                    : "bg-[#f97316] text-white hover:bg-[#ea580c]"
                  }`}
              >
                {progressSaved ? "✓ Saved!" : savingProgress ? "Saving..." : "Save Progress"}
              </button>
            </div>

            {caseData.legal_issue_summary && (
              <>
                <hr className="border-[#d4b896]/50" />
                <div>
                  <span className="text-[#666] block mb-2">Legal Issue Summary</span>
                  <p className="text-[#1a1a1a] text-sm leading-relaxed">{caseData.legal_issue_summary}</p>
                </div>
              </>
            )}

            {caseData.key_evidence_list && caseData.key_evidence_list.length > 0 && (
              <>
                <hr className="border-[#d4b896]/50" />
                <div>
                  <span className="text-[#666] block mb-2">Key Evidence</span>
                  <ul className="list-disc list-inside text-[#1a1a1a] space-y-1">
                    {caseData.key_evidence_list.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {caseData.applicable_laws && caseData.applicable_laws.length > 0 && (
              <>
                <hr className="border-[#d4b896]/50" />
                <div>
                  <span className="text-[#666] block mb-2">Applicable Laws</span>
                  <ul className="list-disc list-inside text-[#1a1a1a] space-y-1">
                    {caseData.applicable_laws.map((law, idx) => (
                      <li key={idx}>{law}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {caseData.recommended_actions && caseData.recommended_actions.length > 0 && (
              <>
                <hr className="border-[#d4b896]/50" />
                <div>
                  <span className="text-[#666] block mb-2">Recommended Actions</span>
                  <ul className="list-disc list-inside text-[#1a1a1a] space-y-1">
                    {caseData.recommended_actions.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {(
              <>
                <hr className="border-[#d4b896]/50" />
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[#666]">Documents ({caseData.documents?.length || 0})</span>
                  <button
                    onClick={() => setShowDocSearch(true)}
                    className="text-xs bg-[#e5ddd0] hover:bg-[#d4b896] text-[#5d4037] px-2 py-1 rounded transition-colors flex items-center gap-1"
                  >
                    <span>+</span> Add Judgement
                  </button>
                </div>

                {/* Search Modal */}
                {showDocSearch && (
                  <div className="mb-4 bg-white p-3 rounded-lg border border-[#d4b896] shadow-sm">
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={docSearchQuery}
                        onChange={(e) => setDocSearchQuery(e.target.value)}
                        placeholder="Search by party name, citation, or act..."
                        className="flex-1 px-3 py-1.5 text-sm border border-[#e5ddd0] rounded focus:outline-none focus:border-[#d4b896]"
                        onKeyDown={(e) => e.key === 'Enter' && handleDocSearch()}
                      />
                      <button
                        onClick={handleDocSearch}
                        disabled={searchingDocs}
                        className="px-3 py-1.5 bg-[#5d4037] text-white text-sm rounded hover:bg-[#4a332d] disabled:opacity-50"
                      >
                        {searchingDocs ? "..." : "Search"}
                      </button>
                      <button onClick={() => setShowDocSearch(false)} className="text-[#888] hover:text-[#555]">
                        ✕
                      </button>
                    </div>

                    {docSearchResults.length > 0 && (
                      <ul className="max-h-40 overflow-y-auto space-y-2 border-t border-[#f0f0f0] pt-2">
                        {docSearchResults.map((res, idx) => (
                          <li key={idx} className="flex justify-between items-start text-xs p-2 hover:bg-[#faf9f6] rounded">
                            <div>
                              <div className="font-medium text-[#333]">{res.title}</div>
                              <div className="text-[#888]">{res.court} • {res.date}</div>
                            </div>
                            <button
                              onClick={() => handleImportDoc(res)}
                              disabled={importingDoc}
                              className="ml-2 text-[#f97316] hover:text-[#c2410c] font-medium disabled:opacity-50"
                            >
                              Import
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {docSearchResults.length === 0 && !searchingDocs && docSearchQuery && (
                      <div className="text-xs text-[#888] text-center py-2">No results found.</div>
                    )}
                  </div>
                )}

                {caseData.documents && (
                  <ul className="space-y-1">
                    {caseData.documents.map((doc, idx) => (
                      <li key={idx} className="text-[#1a1a1a] text-sm flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#f97316]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {doc.filename}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {summary && (
              <>
                <hr className="border-[#d4b896]/50" />
                <div>
                  <span className="text-[#666] block mb-2">AI Summary</span>
                  <p className="text-[#1a1a1a] text-sm leading-relaxed bg-[#f5f1e8] p-3 rounded-lg">{summary}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Chat / Research / Evidence / Acts Panel */}
        <div className="lg:col-span-2 flex flex-col bg-white/50 rounded-xl border border-[#d4b896]/30 overflow-hidden">
          {showActs ? (
            // Acts Analysis Panel
            <div className="p-4 h-full overflow-y-auto">
              <ActsAnalysisPanel
                caseId={caseData.case_id}
                caseType={caseData.case_type || "general"}
                caseDescription={caseData.legal_issue_summary || caseData.raw_description || ""}
                clientName={caseData.client_name}
                onClose={() => setShowActs(false)}
              />
            </div>
          ) : showAgent ? (
            <div className="p-4 h-full overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-[#1a1a1a]">NyayaZephyr Agent</h3>
                <div className="flex gap-2">
                  <button
                    onClick={loadAgentHistory}
                    className="px-3 py-1.5 rounded-lg bg-[#e5ddd0] hover:bg-[#d4c4a8] text-[#1a1a1a] text-sm"
                  >
                    Refresh History
                  </button>
                  <button
                    onClick={handleConnectGoogle}
                    className="px-3 py-1.5 rounded-lg bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm"
                  >
                    Connect Google
                  </button>
                </div>
              </div>

              <div className="bg-[#f5f1e8] border border-[#d4b896] rounded-lg p-4">
                <label className="block text-sm text-[#666] mb-2">Optional Instructions for Agent</label>
                <textarea
                  value={agentInstruction}
                  onChange={(e) => setAgentInstruction(e.target.value)}
                  rows={4}
                  placeholder="e.g., Focus on anticipatory bail precedents and draft a concise action report for tomorrow's hearing."
                  className="w-full px-3 py-2 rounded-lg border border-[#d4b896] bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e]"
                />
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={handleRunAgent}
                    disabled={runningAgent}
                    className="px-4 py-2 rounded-lg bg-[#0f766e] text-white hover:bg-[#115e59] disabled:opacity-50"
                  >
                    {runningAgent ? "Running Agent..." : "Run Agent"}
                  </button>
                  <span className="text-xs text-[#666]">
                    {runningAgent ? `Live status: ${agentRunStatus}${activeRunId ? ` (${activeRunId.slice(0, 8)}...)` : ""}` : "Agent runs on current case file + optional instructions."}
                  </span>
                </div>

                <div className="mt-3 border border-[#d4b896] rounded-lg bg-white p-3">
                  <p className="text-sm font-medium text-[#1a1a1a] mb-2">Agent Logs</p>
                  {runningAgent && currentAgentLogs.length === 0 ? (
                    <p className="text-xs text-[#666]">Run in progress... waiting for first node logs.</p>
                  ) : currentAgentLogs.length === 0 ? (
                    <p className="text-xs text-[#666]">No logs yet. Run the agent to see execution steps.</p>
                  ) : (
                    <div className="max-h-52 overflow-y-auto space-y-2">
                      {currentAgentLogs.map((log, idx) => (
                        <div key={idx} className="text-xs border-b border-[#ece6d9] pb-2 last:border-b-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded bg-[#e5ddd0] text-[#5d4037] uppercase">{log.stage || "stage"}</span>
                            <span className="px-2 py-0.5 rounded bg-[#eef2ff] text-[#3730a3] uppercase">{log.level || "info"}</span>
                            <span className="text-[#666]">{log.ts ? new Date(log.ts).toLocaleTimeString() : ""}</span>
                          </div>
                          <p className="text-[#1a1a1a] whitespace-pre-wrap">{log.message || ""}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {agentError && (
                <div className="p-3 rounded-lg bg-red-100 border border-red-300 text-red-700 text-sm">
                  {agentError}
                </div>
              )}

              {agentResult && (
                <div className="bg-white border border-[#d4b896] rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-[#1a1a1a]">Latest Run Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-[#666]">Run ID:</span> <span className="text-[#1a1a1a]">{agentResult.run_id}</span></div>
                    <div><span className="text-[#666]">Research Results:</span> <span className="text-[#1a1a1a]">{agentResult.research_results_count}</span></div>
                    <div><span className="text-[#666]">Verified:</span> <span className={`${agentResult.verification_passed ? "text-green-700" : "text-amber-700"}`}>{agentResult.verification_passed ? "Yes" : "No"}</span></div>
                    <div><span className="text-[#666]">Email Sent:</span> <span className={`${agentResult.email_sent ? "text-green-700" : "text-amber-700"}`}>{agentResult.email_sent ? "Yes" : "No"}</span></div>
                    <div><span className="text-[#666]">Steps:</span> <span className="text-[#1a1a1a]">{agentResult.step_count}</span></div>
                    <div><span className="text-[#666]">Tool Hops:</span> <span className="text-[#1a1a1a]">{agentResult.tool_hops}</span></div>
                    <div><span className="text-[#666]">Duration:</span> <span className="text-[#1a1a1a]">{Math.max(0, Math.round(agentResult.duration_ms / 1000))}s</span></div>
                    <div><span className="text-[#666]">Stop Reason:</span> <span className="text-[#1a1a1a]">{agentResult.stop_reason || "completed"}</span></div>
                  </div>
                  {agentResult.last_message && (
                    <p className="text-sm text-[#1a1a1a] bg-[#f8f6ef] p-3 rounded-lg">{agentResult.last_message}</p>
                  )}
                  {!agentResult.email_sent && (
                    <div className="p-2 rounded-md bg-amber-100 border border-amber-300 text-amber-800 text-sm">
                      Agent completed, but email was skipped or failed. Use Connect Google and rerun to enable delivery.
                    </div>
                  )}

                  <div className="mt-3">
                    <h5 className="text-sm font-medium text-[#1a1a1a] mb-2">Cases</h5>
                    <ExpandableCaseOutputs
                      items={latestRunFormattedCases}
                      emptyText="No structured case output available for this run."
                    />
                  </div>
                </div>
              )}

              <div className="bg-white border border-[#d4b896] rounded-lg p-4">
                <h4 className="font-medium text-[#1a1a1a] mb-3">Agent Report History</h4>
                {loadingAgentHistory ? (
                  <p className="text-sm text-[#666]">Loading report history...</p>
                ) : agentHistory.length === 0 ? (
                  <p className="text-sm text-[#666]">No agent runs yet for this case.</p>
                ) : (
                  <div className="space-y-3">
                    {agentHistory.map((row) => {
                      const isOpen = expandedRunId === row.run_id;
                      const state = row.state || {};
                      return (
                        <div key={row.run_id} className="border border-[#e5ddd0] rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-[#1a1a1a]">Run {row.run_id.slice(0, 8)}...</p>
                              <p className="text-xs text-[#666]">{new Date(row.created_at).toLocaleString()}</p>
                            </div>
                            <button
                              onClick={() => setExpandedRunId(isOpen ? null : row.run_id)}
                              className="text-xs px-2 py-1 bg-[#e5ddd0] rounded hover:bg-[#d4c4a8]"
                            >
                              {isOpen ? "Hide" : "View"}
                            </button>
                          </div>

                          {isOpen && (
                            <div className="mt-3 space-y-2 text-sm">
                              <p><span className="text-[#666]">Verification:</span> {state.verification_passed ? "Passed" : "Not Passed"}</p>
                              <p><span className="text-[#666]">Email:</span> {state.email_sent ? "Sent" : "Not Sent"}</p>
                              <p><span className="text-[#666]">Research Count:</span> {(state.research_results || []).length}</p>

                              <div className="mt-2">
                                <p className="text-sm font-medium text-[#1a1a1a] mb-2">Cases</p>
                                <ExpandableCaseOutputs
                                  items={Array.isArray(state.formatted_cases) && state.formatted_cases.length > 0 ? state.formatted_cases : fallbackFormattedFromAgentState({ ...state, run_id: row.run_id })}
                                  emptyText="No structured case output available for this run."
                                />
                              </div>

                              {Array.isArray(state.execution_logs) && state.execution_logs.length > 0 && (
                                <div className="bg-[#f8f6ef] rounded p-2 max-h-44 overflow-y-auto">
                                  {state.execution_logs.map((log: AgentLogEntry, idx: number) => (
                                    <div key={idx} className="mb-2 pb-2 border-b border-[#ece6d9] last:border-b-0">
                                      <p className="text-xs text-[#666]">[{log.stage || "stage"}] {log.message || ""}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {state.messages && Array.isArray(state.messages) && state.messages.length > 0 && (
                                <div className="bg-[#f8f6ef] rounded p-2 max-h-56 overflow-y-auto">
                                  {state.messages.map((m: any, idx: number) => (
                                    <div key={idx} className="mb-2 pb-2 border-b border-[#ece6d9] last:border-b-0">
                                      <p className="text-xs text-[#666] mb-1">{m.type || "Message"}</p>
                                      <p className="text-sm text-[#1a1a1a] whitespace-pre-wrap">{typeof m.content === "string" ? m.content : JSON.stringify(m.content)}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : showEvidence ? (
            // Evidence Panel
            <div className="p-4 h-full overflow-y-auto">
              <EvidencePanel
                caseId={caseData.case_id}
                userId={DEFAULT_USER_ID}
                caseType={caseData.case_type || "general"}
                onClose={() => setShowEvidence(false)}
              />
            </div>
          ) : showMultiSource ? (
            // Multi-Source Research Panel (US/UK/Acts)
            <div className="p-4 h-full overflow-y-auto">
              <MultiSourceResearchPanel
                caseType={caseData.case_type || ""}
                caseDescription={caseData.legal_issue_summary || ""}
                onClose={() => setShowMultiSource(false)}
              />
            </div>
          ) : showResearch ? (
            // Research Panel
            <div className="flex flex-col h-full p-4 overflow-y-auto">
              <h3 className="text-lg font-medium text-[#1a1a1a] mb-4">Legal Research - Indian Kanoon</h3>

              {researching ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-10 h-10 mx-auto animate-spin text-[#f97316] mb-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-[#666]">Researching relevant case law...</p>
                  </div>
                </div>
              ) : researchResult ? (
                <div className="space-y-6">
                  <div className="bg-[#f5f1e8] p-4 rounded-lg">
                    <h4 className="font-medium text-[#1a1a1a] mb-2">Summary</h4>
                    <p className="text-sm text-[#1a1a1a]">{researchResult.summary}</p>
                  </div>

                  {researchResult.relevant_cases && researchResult.relevant_cases.length > 0 && (
                    <div>
                      <h4 className="font-medium text-[#1a1a1a] mb-3">📚 Relevant Cases ({researchResult.relevant_cases.length} found)</h4>
                      <ExpandableCaseOutputs
                        items={researchResult.relevant_cases.map((caseInfo) => caseInfo.formatted_output || fallbackFormattedFromResearchCase(caseInfo))}
                        emptyText="No formatted case output available."
                      />
                    </div>
                  )}

                  {researchResult.legal_principles && researchResult.legal_principles.length > 0 && (
                    <div>
                      <h4 className="font-medium text-[#1a1a1a] mb-3">Legal Principles</h4>
                      <ul className="list-disc list-inside space-y-2 text-sm text-[#1a1a1a]">
                        {researchResult.legal_principles.map((principle, idx) => (
                          <li key={idx}>{principle}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {researchResult.recommended_strategy && (
                    <div className="bg-[#e8f5e8] p-4 rounded-lg border border-green-200">
                      <h4 className="font-medium text-green-800 mb-2">Recommended Strategy</h4>
                      <p className="text-sm text-green-700">{researchResult.recommended_strategy}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[#666] mb-4">Click the Research button to find relevant case law and legal precedents.</p>
                    <button
                      onClick={handleResearch}
                      className="px-6 py-2 bg-[#f97316] text-white rounded-lg hover:bg-[#ea580c]"
                    >
                      Start Research
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Chat Panel
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingHistory ? (
                  <div className="text-center text-[#666] py-8">Loading chat history...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-[#666] py-8">
                    <p className="mb-2">No messages yet.</p>
                    <p className="text-sm">Ask questions about this case to get AI-powered insights.</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] px-4 py-3 rounded-xl ${msg.role === "user" ? "bg-[#f97316] text-white" : "bg-[#f5e6c8] text-[#1a1a1a]"}`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-[#f5e6c8] px-4 py-3 rounded-xl">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-[#d4b896] rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-[#d4b896] rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                        <div className="w-2 h-2 bg-[#d4b896] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 border-t border-[#d4b896]/30">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder="Ask about this case..."
                    className="flex-1 px-4 py-2.5 rounded-lg border border-[#d4b896] bg-white focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                  />
                  <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="px-6 py-2.5 bg-[#f97316] text-white rounded-lg hover:bg-[#ea580c] disabled:opacity-50 transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div >
  );
}

// ==================== MAIN PAGE ====================
interface LegalResearcherPageProps {
  onNavigate?: (page: string) => void;
}

export default function LegalResearcherPage({ onNavigate: _onNavigate }: LegalResearcherPageProps) {
  const [view, setView] = useState<"dashboard" | "drafting">("dashboard");
  const [cases, setCases] = useState<CaseDetails[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stats, setStats] = useState<{ total_cases: number; total_documents: number; total_chats: number } | null>(null);

  // Load cached data on mount, then fetch fresh data in background
  useEffect(() => {
    // Try to load from cache first for instant display
    const cachedCases = sessionStorage.getItem('legal_cases');
    const cachedStats = sessionStorage.getItem('legal_stats');

    if (cachedCases) {
      setCases(JSON.parse(cachedCases));
      setLoading(false);
    }
    if (cachedStats) {
      setStats(JSON.parse(cachedStats));
    }

    // Then fetch fresh data
    fetchCases();
    fetchStats();
  }, []);

  const fetchCases = async () => {
    if (!sessionStorage.getItem('legal_cases')) {
      setLoading(true);
    }
    try {
      const res = await getUserCases(DEFAULT_USER_ID);
      if (res.success) {
        setCases(res.cases);
        sessionStorage.setItem('legal_cases', JSON.stringify(res.cases));
      }
    } catch (err) {
      console.error("Failed to fetch cases", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await getUserStats(DEFAULT_USER_ID);
      if (res.success && res.stats) {
        setStats(res.stats);
        sessionStorage.setItem('legal_stats', JSON.stringify(res.stats));
      }
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  const handleSelectCase = async (caseId: number) => {
    try {
      const res = await getCase(caseId, DEFAULT_USER_ID);
      if (res.success && res.case) {
        setSelectedCase(res.case);
      }
    } catch (err) {
      console.error("Failed to load case", err);
    }
  };

  const handleDeleteCase = async (caseId: number) => {
    if (!confirm("Are you sure you want to delete this case?")) return;
    try {
      const res = await deleteCase(caseId, DEFAULT_USER_ID);
      if (res.success) {
        setSelectedCase(null);
        fetchCases();
        fetchStats();
      }
    } catch (err) {
      console.error("Failed to delete case", err);
    }

  };

  const handleRefreshCase = async (caseId: number) => {
    try {
      const res = await getCase(caseId, DEFAULT_USER_ID);
      if (res.success && res.case) {
        setSelectedCase(res.case);
      }
    } catch (e) { console.error("Refresh failed", e); }
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[32px] font-normal text-[#1a1a1a]" style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}>
            Legal Researcher
          </h1>
          <p className="text-[#666]" style={{ fontFamily: "Montserrat, sans-serif" }}>
            AI-powered case management and legal research
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-[#e5ddd0] p-1 rounded-lg">
            <button
              onClick={() => setView("dashboard")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${view === "dashboard" ? "bg-white text-[#1a1a1a] shadow-sm" : "text-[#666] hover:text-[#1a1a1a]"}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView("drafting")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${view === "drafting" ? "bg-white text-[#1a1a1a] shadow-sm" : "text-[#666] hover:text-[#1a1a1a]"}`}
            >
              Drafting Assistant
            </button>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2 bg-[#f97316] text-white rounded-lg hover:bg-[#ea580c] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Case
          </button>
        </div>
      </div>

      {view === "drafting" ? (
        <div className="flex-1 -m-6 z-10">
          <DraftingAssistant cases={cases} userId={DEFAULT_USER_ID} onBack={() => setView("dashboard")} />
        </div>
      ) : (
        <>
          {/* Stats Bar */}
          {stats && !selectedCase && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-[#f5e6c8]/80 rounded-xl p-4 border border-[#d4b896]/50">
                <p className="text-2xl font-bold text-[#1a1a1a]">{stats.total_cases}</p>
                <p className="text-sm text-[#666]">Total Cases</p>
              </div>
              <div className="bg-[#f5e6c8]/80 rounded-xl p-4 border border-[#d4b896]/50">
                <p className="text-2xl font-bold text-[#1a1a1a]">{stats.total_documents}</p>
                <p className="text-sm text-[#666]">Documents</p>
              </div>
              <div className="bg-[#f5e6c8]/80 rounded-xl p-4 border border-[#d4b896]/50">
                <p className="text-2xl font-bold text-[#1a1a1a]">{stats.total_chats}</p>
                <p className="text-sm text-[#666]">Chat Messages</p>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 min-h-0">
            {selectedCase ? (
              <CaseDetailView
                caseData={selectedCase}
                onBack={() => setSelectedCase(null)}
                onDelete={handleDeleteCase}
                onRefresh={() => handleRefreshCase(selectedCase.case_id)}
              />
            ) : (
              <div className="h-full overflow-y-auto">
                {loading ? (
                  <div className="text-center py-12 text-[#666]">Loading cases...</div>
                ) : cases.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-[#d4b896] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">No cases yet</h3>
                    <p className="text-[#666] mb-6">Create your first case to get started with AI-powered legal research.</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-6 py-3 bg-[#f97316] text-white rounded-lg hover:bg-[#ea580c] transition-colors"
                    >
                      Create Your First Case
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cases.map((caseItem) => (
                      <motion.div
                        key={caseItem.case_id}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => handleSelectCase(caseItem.case_id)}
                        className="bg-[#f5e6c8]/80 rounded-xl p-5 border border-[#d4b896]/50 cursor-pointer hover:shadow-lg transition-all"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700">
                            {caseItem.case_type || "General"}
                          </span>
                          <span className="text-xs text-[#666]">{new Date(caseItem.created_at).toLocaleDateString()}</span>
                        </div>
                        <h3 className="text-lg font-medium text-[#1a1a1a] mb-2" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                          {caseItem.client_name}
                        </h3>
                        {caseItem.opposing_party && (
                          <p className="text-sm text-[#666] mb-3">vs {caseItem.opposing_party}</p>
                        )}
                        {caseItem.legal_issue_summary && (
                          <p className="text-sm text-[#1a1a1a] line-clamp-2">{caseItem.legal_issue_summary}</p>
                        )}
                        {caseItem.documents && caseItem.documents.length > 0 && (
                          <p className="text-xs text-[#8b7355] mt-3 pt-2 border-t border-[#d4b896]/30">
                            📎 {caseItem.documents.length} document{caseItem.documents.length > 1 ? 's' : ''} attached
                          </p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )
      }

      {/* Modals */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateCaseModal
            onClose={() => setShowCreateModal(false)}
            onCaseCreated={() => { fetchCases(); fetchStats(); }}
          />
        )}
      </AnimatePresence>
    </div >
  );
}
