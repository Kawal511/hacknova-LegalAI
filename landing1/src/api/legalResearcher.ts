// Legal Researcher API Service
// Connects to the backend API at /legal/* endpoints

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/legal";

// Safe fetch wrapper to prevent crashes
export async function safeFetch(url: string, options?: RequestInit, timeoutMs: number = 30000): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please try again');
      }
      throw new Error(`Network error: ${error.message}`);
    }
    throw new Error('Unknown network error');
  }
}

// ==================== AUTH ====================

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user_id?: number;
  username?: string;
  message?: string;
}

export async function registerUser(data: RegisterRequest): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function loginUser(data: LoginRequest): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
}

// ==================== CASES ====================

// Backend returns structured_data as nested object, so we flatten for UI convenience
export interface StructuredData {
  client_name?: string;
  opposing_party?: string;
  incident_date?: string;
  case_type?: string;
  legal_issue_summary?: string;
  key_evidence_list?: string[];
  applicable_laws?: string[];
  recommended_actions?: string[];
}

export interface BackendCase {
  case_id: number;
  client_name: string;
  structured_data: StructuredData;
  raw_description?: string;
  created_at: string;
  documents?: Array<{ filename: string; chars: number }>;
  progress: number;
  stage: string;
  is_complete: boolean;
}

// Flattened case for UI
export interface CaseDetails {
  case_id: number;
  client_name: string;
  opposing_party: string;
  incident_date: string;
  case_type: string;
  legal_issue_summary: string;
  key_evidence_list: string[];
  applicable_laws: string[];
  recommended_actions: string[];
  raw_description: string;
  created_at: string;
  documents: Array<{ filename: string; chars: number }>;
  progress: number;
  stage: string;
  is_complete: boolean;
}

// Progress update request
export interface ProgressUpdateRequest {
  user_id: number;
  progress: number;
  stage: string;
}

export interface ProgressUpdateResponse {
  success: boolean;
  message: string;
  progress: number;
  stage: string;
  is_complete: boolean;
}

// Convert backend case to flattened UI case
function flattenCase(backendCase: BackendCase): CaseDetails {
  const sd = backendCase.structured_data || {};
  return {
    case_id: backendCase.case_id,
    client_name: backendCase.client_name || sd.client_name || "Unknown",
    opposing_party: sd.opposing_party || "",
    incident_date: sd.incident_date || "",
    case_type: sd.case_type || "",
    legal_issue_summary: sd.legal_issue_summary || "",
    key_evidence_list: sd.key_evidence_list || [],
    applicable_laws: sd.applicable_laws || [],
    recommended_actions: sd.recommended_actions || [],
    raw_description: backendCase.raw_description || "",
    created_at: backendCase.created_at,
    documents: backendCase.documents || [],
    progress: backendCase.progress || 0,
    stage: backendCase.stage || "",
    is_complete: backendCase.is_complete || false,
  };
}

// Update case progress and stage
export async function updateCaseProgress(
  caseId: number,
  data: ProgressUpdateRequest
): Promise<ProgressUpdateResponse> {
  const response = await fetch(`${API_BASE}/cases/${caseId}/progress?user_id=${data.user_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to update progress: ${response.statusText}`);
  }
  return response.json();
}

export interface CaseCreateManual {
  client_name: string;
  opposing_party?: string;
  incident_date?: string;
  case_type?: string;
  legal_issue_summary?: string;
  key_evidence_list?: string[];
  applicable_laws?: string[];
  recommended_actions?: string[];
}

export interface CaseCreateAI {
  raw_notes: string;
}

export interface CaseListResponse {
  success: boolean;
  cases: CaseDetails[];
  total: number;
}

export interface CaseResponse {
  success: boolean;
  case_id?: number;
  case?: CaseDetails;
  message?: string;
}

export async function createCaseManual(userId: number, data: CaseCreateManual): Promise<CaseResponse> {
  try {
    const response = await fetch(`${API_BASE}/cases/manual?user_id=${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, message: errorData.detail || "Failed to create case" };
    }

    const backendCase: BackendCase = await response.json();
    return {
      success: true,
      case_id: backendCase.case_id,
      case: flattenCase(backendCase),
    };
  } catch (error) {
    return { success: false, message: "Connection failed" };
  }
}

export async function createCaseAI(userId: number, data: CaseCreateAI): Promise<CaseResponse> {
  try {
    const response = await fetch(`${API_BASE}/cases/ai-extract?user_id=${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, message: errorData.detail || "AI extraction failed" };
    }

    const backendCase: BackendCase = await response.json();
    return {
      success: true,
      case_id: backendCase.case_id,
      case: flattenCase(backendCase),
    };
  } catch (error) {
    return { success: false, message: "Connection failed" };
  }
}

export async function uploadCasePDF(userId: number, file: File): Promise<CaseResponse> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/cases/pdf-upload?user_id=${userId}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, message: errorData.detail || "PDF upload failed" };
    }

    const backendCase: BackendCase = await response.json();
    return {
      success: true,
      case_id: backendCase.case_id,
      case: flattenCase(backendCase),
    };
  } catch (error) {
    return { success: false, message: "Connection failed" };
  }
}

export async function uploadEvidence(caseId: number, file: File, description: string, userId: number = 1): Promise<any> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("description", description);
    formData.append("case_id", caseId.toString());
    formData.append("user_id", userId.toString());

    // Check file type to determine endpoint
    const isVideo = file.type.startsWith('video/');
    const endpoint = isVideo ? 'analyze-video' : 'analyze-image';

    const response = await fetch(`${API_BASE}/evidence/${endpoint}`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(60000) // 60s timeout for file uploads
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Evidence upload failed");
    }

    return response.json();
  } catch (error) {
    console.error('Evidence upload error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to upload evidence - please try again');
  }
}

export async function getUserCases(userId: number): Promise<CaseListResponse> {
  try {
    const response = await fetch(`${API_BASE}/cases?user_id=${userId}`, {
      signal: AbortSignal.timeout(15000) // 15s timeout
    });

    if (!response.ok) {
      console.error('Failed to fetch cases:', response.status, response.statusText);
      return { success: false, cases: [], total: 0 };
    }

    const data: { cases: BackendCase[]; total: number } = await response.json();
    return {
      success: true,
      cases: data.cases.map(flattenCase),
      total: data.total,
    };
  } catch (error) {
    return { success: false, cases: [], total: 0 };
  }
}

export async function getCase(caseId: number, userId: number): Promise<CaseResponse> {
  try {
    const response = await fetch(`${API_BASE}/cases/${caseId}?user_id=${userId}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, message: errorData.detail || "Case not found" };
    }

    const backendCase: BackendCase = await response.json();
    return {
      success: true,
      case_id: backendCase.case_id,
      case: flattenCase(backendCase),
    };
  } catch (error) {
    return { success: false, message: "Connection failed" };
  }
}

export async function deleteCase(caseId: number, userId: number): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/cases/${caseId}?user_id=${userId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, message: errorData.detail || "Failed to delete" };
    }

    const data = await response.json();
    return { success: true, message: data.message || "Case deleted" };
  } catch (error) {
    return { success: false, message: "Connection failed" };
  }
}

// ==================== CHAT ====================

export interface ChatRequest {
  case_id: number;
  query: string;
  language?: string;
}

export interface ChatResponse {
  success: boolean;
  response?: string;
  case_id?: number;
  message?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface ChatHistoryResponse {
  success: boolean;
  case_id?: number;
  messages: ChatMessage[];
}

export interface ChatSummaryResponse {
  success: boolean;
  summary?: string;
  case_id?: number;
  message?: string;
}

export async function chatWithCase(data: ChatRequest, userId: number = 1): Promise<ChatResponse> {
  try {
    const response = await fetch(`${API_BASE}/chat?user_id=${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, message: errorData.detail || "Chat failed" };
    }

    const chatData = await response.json();
    return {
      success: true,
      response: chatData.response,
      case_id: chatData.case_id,
    };
  } catch (error) {
    return { success: false, message: "Connection failed" };
  }
}

export async function getChatHistory(caseId: number, userId: number = 1): Promise<ChatHistoryResponse> {
  try {
    const response = await fetch(`${API_BASE}/chat/history/${caseId}?user_id=${userId}`);

    if (!response.ok) {
      return { success: false, messages: [] };
    }

    const data = await response.json();
    return {
      success: true,
      case_id: data.case_id,
      messages: data.messages || [],
    };
  } catch (error) {
    return { success: false, messages: [] };
  }
}

export async function getChatSummary(caseId: number, userId: number = 1): Promise<ChatSummaryResponse> {
  try {
    const response = await fetch(`${API_BASE}/chat/summary/${caseId}?user_id=${userId}`);

    if (!response.ok) {
      return { success: false, message: "Failed to get summary" };
    }

    const data = await response.json();
    return {
      success: true,
      summary: data.summary,
      case_id: data.case_id,
    };
  } catch (error) {
    return { success: false, message: "Connection failed" };
  }
}

export async function clearChatHistory(caseId: number, userId: number = 1): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/chat/history/${caseId}?user_id=${userId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      return { success: false, message: "Failed to clear history" };
    }

    const data = await response.json();
    return { success: true, message: data.message || "History cleared" };
  } catch (error) {
    return { success: false, message: "Connection failed" };
  }
}

// ==================== AGENT ====================

const AGENT_BASE = `${API_BASE}/agent`;

function getStoredAccessToken(): string | null {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("legal_access_token") ||
    sessionStorage.getItem("access_token") ||
    null
  );
}

function buildAuthHeaders(): HeadersInit {
  const token = getStoredAccessToken();
  if (!token) {
    return { "Content-Type": "application/json" };
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export interface AgentRunResponse {
  run_id: string;
  case_id: number;
  user_id: number;
  verification_passed: boolean;
  email_sent: boolean;
  calendar_event_id: string;
  research_results_count: number;
  last_message: string;
  step_count: number;
  tool_hops: number;
  stop_reason: string;
  duration_ms: number;
  logs: AgentLogEntry[];
  formatted_cases?: FormattedCaseOutput[];
}

export interface AgentRunAsyncResponse {
  run_id: string;
  case_id: number;
  user_id: number;
  status: "running";
}

export interface AgentRunStatusResponse extends AgentRunResponse {
  status: "running" | "completed" | "failed";
  created_at?: string;
  updated_at?: string;
}

export interface FormattedOtherSection {
  title: string;
  content: string;
}

export interface FormattedCaseOutput {
  title: string;
  source?: string;
  details?: string[];
  judgement?: string;
  summary?: string;
  key_points?: string[];
  ai_message?: string;
  other_sections?: FormattedOtherSection[];
}

export interface AgentLogEntry {
  ts?: string;
  level?: string;
  stage?: string;
  message?: string;
}

export interface AgentHistoryItem {
  run_id: string;
  case_id: number;
  user_id: number;
  state: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export async function runAgent(caseId: number, userId: number, message?: string): Promise<AgentRunResponse> {
  const response = await safeFetch(`${AGENT_BASE}/run/${caseId}?user_id=${userId}`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ message: message || "" }),
  }, 180000);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to run agent");
  }

  return response.json();
}

export async function runAgentAsync(caseId: number, userId: number, message?: string): Promise<AgentRunAsyncResponse> {
  const response = await safeFetch(`${AGENT_BASE}/run_async/${caseId}?user_id=${userId}`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ message: message || "" }),
  }, 15000);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to start agent run");
  }

  return response.json();
}

export async function getAgentRunStatus(runId: string, userId: number): Promise<AgentRunStatusResponse> {
  const response = await safeFetch(`${AGENT_BASE}/run_status/${runId}?user_id=${userId}`, {
    headers: buildAuthHeaders(),
  }, 15000);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to load run status");
  }

  return response.json();
}

export async function getAgentHistory(caseId: number, userId: number): Promise<AgentHistoryItem[]> {
  const response = await safeFetch(`${AGENT_BASE}/history/${caseId}?user_id=${userId}`, {
    headers: buildAuthHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to load agent history");
  }

  return response.json();
}

export async function startGoogleAuth(redirectUri: string, userId?: number): Promise<{ auth_url: string }> {
  const userParam = userId !== undefined ? `&user_id=${encodeURIComponent(String(userId))}` : "";
  const response = await safeFetch(`${AGENT_BASE}/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}${userParam}`, {
    headers: buildAuthHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to start Google OAuth");
  }

  return response.json();
}

// ==================== RESEARCH ====================

export interface ResearchRequest {
  client_name: string;
  case_title: string;
  description: string;
}

export interface CaseInfo {
  title: string;
  url: string;
  snippet: string;
  court?: string;
  date?: string;
  case_type?: string;
  verdict?: string;
  ai_summary?: string;
  formatted_output?: FormattedCaseOutput;
}

export interface ResearchResult {
  query: string;
  summary: string;
  relevant_cases: CaseInfo[];
  legal_principles: string[];
  recommended_strategy: string;
}

export interface ResearchResponse {
  success: boolean;
  research?: ResearchResult;
  message?: string;
}

// Backend response structure
interface BackendCaseInfo {
  url: string;
  case_title: string;
  court: string;
  date: string;
  case_type: string;
  verdict: string;
  parties: { petitioner: string; respondent: string };
  summary: string;
  ai_summary?: string;
  formatted_output?: FormattedCaseOutput;
}

interface BackendResearchResponse {
  success: boolean;
  client_name: string;
  case_title: string;
  results: BackendCaseInfo[];
  total_found: number;
}

export async function conductResearch(data: ResearchRequest): Promise<ResearchResponse> {
  try {
    // Use longer timeout (90s) for research as Firecrawl scraping can be slow
    const response = await fetch(`${API_BASE}/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(90000), // 90s timeout for research
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, message: errorData.detail || "Research failed" };
    }

    const backendData: BackendResearchResponse = await response.json();

    // Transform backend response to frontend format
    const relevantCases: CaseInfo[] = backendData.results.map((r) => ({
      title: r.case_title,
      url: r.url,
      snippet: r.ai_summary || r.summary,
      court: r.court,
      date: r.date,
      case_type: r.case_type,
      verdict: r.verdict,
      ai_summary: r.ai_summary,
      formatted_output: r.formatted_output,
    }));

    // Extract legal principles from verdicts and case types
    const legalPrinciples: string[] = [];
    const seenPrinciples = new Set<string>();
    backendData.results.forEach((r) => {
      if (r.verdict && r.verdict !== "Not determined" && !seenPrinciples.has(r.verdict)) {
        legalPrinciples.push(`${r.case_title}: ${r.verdict}`);
        seenPrinciples.add(r.verdict);
      }
    });

    // Generate summary from AI summaries
    const summaryParts = backendData.results
      .filter((r) => r.ai_summary)
      .map((r) => r.ai_summary)
      .slice(0, 3);
    const summary = summaryParts.length > 0
      ? `Found ${backendData.total_found} relevant cases. ${summaryParts.join(" ")}`
      : `Found ${backendData.total_found} relevant cases from Indian Kanoon.`;

    // Generate strategy based on verdicts
    const verdictCounts: Record<string, number> = {};
    backendData.results.forEach((r) => {
      if (r.verdict && r.verdict !== "Not determined") {
        verdictCounts[r.verdict] = (verdictCounts[r.verdict] || 0) + 1;
      }
    });
    const mostCommonVerdict = Object.entries(verdictCounts).sort((a, b) => b[1] - a[1])[0];
    const recommendedStrategy = mostCommonVerdict
      ? `Based on similar cases, the most common outcome was "${mostCommonVerdict[0]}". Review the cited cases carefully and build your arguments around the established precedents.`
      : `Review the ${backendData.total_found} cases found to identify applicable legal precedents and build your case strategy.`;

    return {
      success: true,
      research: {
        query: data.description,
        summary,
        relevant_cases: relevantCases,
        legal_principles: legalPrinciples,
        recommended_strategy: recommendedStrategy,
      },
    };
  } catch (error) {
    return { success: false, message: "Connection failed" };
  }
}

export async function getResearchHistory(clientName: string): Promise<{ success: boolean; research_history: ResearchResult[] }> {
  try {
    const response = await fetch(`${API_BASE}/research/history/${encodeURIComponent(clientName)}`);

    if (!response.ok) {
      return { success: false, research_history: [] };
    }

    const data = await response.json();
    return {
      success: true,
      research_history: data.research_history || [],
    };
  } catch (error) {
    return { success: false, research_history: [] };
  }
}

// ==================== EXPORT ====================

export async function exportCasePDF(caseId: number, userId: number): Promise<Blob | null> {
  try {
    const response = await fetch(`${API_BASE}/export/${caseId}?user_id=${userId}`);

    if (!response.ok) {
      return null;
    }

    return await response.blob();
  } catch (error) {
    return null;
  }
}

// ==================== STATS ====================

export interface UserStats {
  total_cases: number;
  total_documents: number;
  total_chats: number;
}

export interface UserStatsResponse {
  success: boolean;
  stats?: UserStats;
  message?: string;
}

export async function getUserStats(userId: number): Promise<UserStatsResponse> {
  try {
    const response = await fetch(`${API_BASE}/stats/${userId}`);

    if (!response.ok) {
      return { success: false, message: "Failed to get stats" };
    }

    const data = await response.json();
    return {
      success: true,
      stats: data,
    };
  } catch (error) {
    return { success: false, message: "Connection failed" };
  }
}

// ==================== ECOURTS INDIA ====================

export interface ECourtsStats {
  success: boolean;
  timestamp: string;
  hc_complexes: number;
  hc_pending_cases: string;
  hc_pending_cases_raw: number;
  hc_disposed_cases: string;
  hc_disposed_cases_raw: number;
  hc_cases_listed_today: string;
  hc_cases_listed_today_raw: number;
  dc_complexes: number;
  dc_pending_cases: string;
  dc_pending_cases_raw: number;
  dc_disposed_last_month: string;
  dc_disposed_last_month_raw: number;
  dc_cases_listed_today: string;
  dc_cases_listed_today_raw: number;
}

export async function getECourtsStatistics(): Promise<ECourtsStats> {
  // Return cached data if available for instant display
  const cached = sessionStorage.getItem('ecourts_stats');
  if (cached) {
    // Return cached immediately, fetch fresh in background
    const cachedData = JSON.parse(cached) as ECourtsStats;
    fetch(`${API_BASE}/ecourts/statistics`, { signal: AbortSignal.timeout(10000) })
      .then(r => r.json())
      .then(data => sessionStorage.setItem('ecourts_stats', JSON.stringify(data)))
      .catch(() => { }); // Silent fail for background refresh
    return cachedData;
  }

  try {
    const response = await fetch(`${API_BASE}/ecourts/statistics`, {
      signal: AbortSignal.timeout(2000), // 2s timeout for instant load feeling
    });
    if (!response.ok) {
      throw new Error("Failed to fetch eCourts statistics");
    }
    const data = await response.json();
    sessionStorage.setItem('ecourts_stats', JSON.stringify(data));
    return data;
  } catch (error) {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      hc_complexes: 39,
      hc_pending_cases: "6.38 M",
      hc_pending_cases_raw: 6380000,
      hc_disposed_cases: "43.08 M",
      hc_disposed_cases_raw: 43080000,
      hc_cases_listed_today: "48.25 K",
      hc_cases_listed_today_raw: 48250,
      dc_complexes: 3681,
      dc_pending_cases: "47.69 M",
      dc_pending_cases_raw: 47690000,
      dc_disposed_last_month: "213.12 M",
      dc_disposed_last_month_raw: 213120000,
      dc_cases_listed_today: "1.16 M",
      dc_cases_listed_today_raw: 1160000,
    };
  }
}

export interface ECourtsNotice {
  title: string;
  date: string;
  category: string;
  issuing_authority: string;
  document_url: string;
  summary?: string;
}

export async function getECourtsNotices(limit: number = 20): Promise<{ success: boolean; total: number; notices: ECourtsNotice[] }> {
  try {
    const response = await fetch(`${API_BASE}/ecourts/notices?limit=${limit}`);
    if (!response.ok) {
      return { success: false, total: 0, notices: [] };
    }
    return response.json();
  } catch (error) {
    return { success: false, total: 0, notices: [] };
  }
}

// ==================== INDIACODE ACTS ====================

export interface ActResult {
  act_id: string;
  title: string;
  short_title: string;
  year: number;
  act_number: string;
  category: string;
  ministry: string;
  status: string;
  last_amended?: string;
  enforcement_date?: string;
  preamble: string;
  sections_count: number;
  key_sections: string[];
  related_acts: string[];
  full_text_url: string;
  relevance_score: number;
}

export interface ActSearchRequest {
  query: string;
  category?: string;
  year_from?: number;
  year_to?: number;
  ministry?: string;
  status?: string;
  max_results?: number;
}

export async function searchActs(request: ActSearchRequest): Promise<{ success: boolean; query: string; total_found: number; results: ActResult[] }> {
  try {
    const response = await fetch(`${API_BASE}/acts/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      return { success: false, query: request.query, total_found: 0, results: [] };
    }
    return response.json();
  } catch (error) {
    return { success: false, query: request.query, total_found: 0, results: [] };
  }
}

export interface RelevantActsRequest {
  case_description: string;
  case_type: string;
  dispute_summary: string;
}

export interface RelevantActsResponse {
  success: boolean;
  primary_acts: any[];
  secondary_acts: any[];
  sections_to_cite: any[];
  analysis: string;
}

export async function findRelevantActs(request: RelevantActsRequest): Promise<RelevantActsResponse> {
  try {
    const response = await fetch(`${API_BASE}/acts/relevant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      return { success: false, primary_acts: [], secondary_acts: [], sections_to_cite: [], analysis: "" };
    }
    return response.json();
  } catch (error) {
    return { success: false, primary_acts: [], secondary_acts: [], sections_to_cite: [], analysis: "" };
  }
}

// ==================== INTERNATIONAL RESEARCH ====================

export interface InternationalSearchRequest {
  query: string;
  jurisdictions: string[];
  date_from?: string;
  date_to?: string;
  court_level?: string;
  max_results?: number;
}

export interface InternationalCase {
  case_title: string;
  citation: string;
  court: string;
  jurisdiction: string;
  date: string;
  summary: string;
  full_text_url: string;
  relevance_score: number;
}

export interface InternationalResearchResponse {
  success: boolean;
  query: string;
  jurisdictions_searched: string[];
  total_found: number;
  us_cases: InternationalCase[];
  uk_cases: InternationalCase[];
}



// ==================== DRAFTING ====================

export interface SaveDraftRequest {
  case_id: number;
  user_id: number;
  filename: string;
  content: string;
}

export async function saveDraft(data: SaveDraftRequest): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/drafting/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, message: errorData.detail || "Failed to save draft" };
    }
    return response.json();
  } catch (error) {
    return { success: false, message: "Connection failed" };
  }
}

export interface DraftingRequest {
  case_id: number;
  user_id: number;
  current_text: string;
  instruction: string;
  context?: string;
}

export interface DraftingResponse {
  suggestion: string;
  reasoning: string;
  citations: string[];
}

export async function suggestDrafting(data: DraftingRequest): Promise<DraftingResponse> {
  const response = await fetch(`${API_BASE}/drafting/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Drafting API error: ${response.statusText}`);
  }
  return response.json();
}


export async function searchInternationalCases(request: InternationalSearchRequest): Promise<InternationalResearchResponse> {
  try {
    const response = await fetch(`${API_BASE}/research/international`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      return { success: false, query: request.query, jurisdictions_searched: [], total_found: 0, us_cases: [], uk_cases: [] };
    }
    return response.json();
  } catch (error) {
    return { success: false, query: request.query, jurisdictions_searched: [], total_found: 0, us_cases: [], uk_cases: [] };
  }
}

// ==================== COMPREHENSIVE RESEARCH ====================

export interface ComprehensiveResearchRequest {
  client_name: string;
  case_title: string;
  case_description: string;
  case_type: string;
  search_scope: string[];
  include_international: boolean;
  max_results_per_source?: number;
}

export interface ComprehensiveResearchResponse {
  success: boolean;
  request_id: string;
  timestamp: string;
  indian_cases: any[];
  us_cases: any[];
  uk_cases: any[];
  relevant_acts: any[];
  ecourts_stats?: ECourtsStats;
  ai_summary: string;
  recommended_strategy: string;
}

export async function conductComprehensiveResearch(request: ComprehensiveResearchRequest): Promise<ComprehensiveResearchResponse> {
  try {
    const response = await fetch(`${API_BASE}/research/comprehensive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      return {
        success: false,
        request_id: "",
        timestamp: new Date().toISOString(),
        indian_cases: [],
        us_cases: [],
        uk_cases: [],
        relevant_acts: [],
        ai_summary: "",
        recommended_strategy: "",
      };
    }
    return response.json();
  } catch (error) {
    return {
      success: false,
      request_id: "",
      timestamp: new Date().toISOString(),
      indian_cases: [],
      us_cases: [],
      uk_cases: [],
      relevant_acts: [],
      ai_summary: "",
      recommended_strategy: "",
    };
  }
}

// ==================== LOCAL STORAGE ====================

const AUTH_KEY = "legal_researcher_auth";

export interface StoredAuth {
  user_id: number;
  username: string;
}

export function saveAuth(auth: StoredAuth): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function getStoredAuth(): StoredAuth | null {
  const stored = localStorage.getItem(AUTH_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return null;
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_KEY);
}

// ==================== KANOON IMPORT ====================

export interface ImportKanoonResponse {
  success: boolean;
  document_id: number;
  message: string;
}

export async function importKanoonDocument(
  caseId: number,
  url: string,
  title: string,
  userId: number = 1
): Promise<ImportKanoonResponse> {
  const response = await fetch(`${API_BASE}/cases/import-kanoon?user_id=${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ case_id: caseId, url, title }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Import failed");
  }

  return response.json();
}

export interface KanoonSearchResult {
  url: string;
  title: string;
  date: string;
  court: string;
}

export interface SearchKanoonResponse {
  results: KanoonSearchResult[];
}

export async function searchKanoon(query: string): Promise<SearchKanoonResponse> {
  const response = await fetch(`${API_BASE}/cases/search-kanoon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error("Search failed");
  return response.json();
}

// ==================== EVIDENCE ====================

export interface EvidenceItem {
  evidence_id: number;
  case_id: number;
  client_name?: string;
  file_type: string;
  original_filename: string;
  file_size: number;
  uploaded_at: string;
  is_nsfw: boolean;
  content_warning?: string;
  thumbnail_path?: string;
  analysis?: any;
}

export async function getRecentEvidence(userId: number, limit: number = 50): Promise<EvidenceItem[]> {
  try {
    const response = await fetch(`${API_BASE}/evidence/recent?user_id=${userId}&limit=${limit}`);
    if (!response.ok) {
      // Silent fail for dashboard
      return [];
    }
    return response.json();
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getCaseResearchHistory(caseId: number, userId: number): Promise<any> {
  const response = await fetch(`${API_BASE}/cases/${caseId}/research-history?user_id=${userId}`);
  if (!response.ok) return { success: false, history: [] };
  return response.json();
}



