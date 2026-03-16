// Evidence Timeline API Client
// Matches fetch pattern from legalResearcher.ts

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/legal";

// ====================== TYPES ======================

export interface TimelineEvent {
  id: number;
  caseId: number;
  title: string;
  description: string;
  eventDate: string;
  evidenceType: string;
  sourceFile: string;
  annotation: string;
}

export interface CreateEventPayload {
  caseId: number;
  title: string;
  description: string;
  eventDate: string;
  evidenceType: string;
  sourceFile: string;
}

// ====================== HELPERS ======================

interface RawTimelineEvent {
  id: number;
  case_id: number;
  title: string;
  description: string;
  event_date: string;
  evidence_type: string;
  source_file: string;
  annotation: string;
}

function mapEvent(raw: RawTimelineEvent): TimelineEvent {
  return {
    id: raw.id,
    caseId: raw.case_id,
    title: raw.title,
    description: raw.description,
    eventDate: raw.event_date,
    evidenceType: raw.evidence_type,
    sourceFile: raw.source_file,
    annotation: raw.annotation,
  };
}

// ====================== API FUNCTIONS ======================

export async function fetchTimeline(caseId: number, userId: number = 1): Promise<TimelineEvent[]> {
  const url = `${API_BASE}/evidence/timeline/${caseId}?user_id=${userId}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    if (response.status === 404) {
      // 404 is normal for a case that doesn't exist or has no events yet
      // Our UI handles falling back to mock data
      throw new Error('Case not found');
    }
    throw new Error(`Failed to fetch timeline events: ${response.statusText}`);
  }
  const data: RawTimelineEvent[] = await response.json();
  return data.map(mapEvent);
}

export async function annotateEvent(eventId: number, annotation: string, userId: number = 1): Promise<TimelineEvent> {
  const response = await fetch(`${API_BASE}/evidence/timeline/${eventId}/annotate?user_id=${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ annotation }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to annotate event: ${response.statusText}`);
  }

  const data: RawTimelineEvent = await response.json();
  return mapEvent(data);
}

export async function createEvent(payload: CreateEventPayload, userId: number = 1): Promise<TimelineEvent> {
  const response = await fetch(`${API_BASE}/evidence/timeline/event?user_id=${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      case_id: payload.caseId,
      title: payload.title,
      description: payload.description,
      event_date: payload.eventDate,
      evidence_type: payload.evidenceType,
      source_file: payload.sourceFile,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to create event: ${response.statusText}`);
  }

  const data: RawTimelineEvent = await response.json();
  return mapEvent(data);
}
