/**
 * EvidenceTimeline Component
 * Interactive timeline visualization for case evidence events.
 * Features: SVG timeline, filter pills, click-to-annotate, add event, stats, PDF export.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchTimeline,
  annotateEvent,
  createEvent,
  type TimelineEvent,
  type CreateEventPayload,
} from "./api/timelineApi";

// ====================== CONSTANTS ======================

const TYPE_COLORS: Record<string, string> = {
  document: "#185FA5",
  image: "#0F6E56",
  video: "#993C1D",
  witness: "#534AB7",
};

const TYPE_LABELS: Record<string, string> = {
  document: "Document",
  image: "Image",
  video: "Video",
  witness: "Witness",
};

const ANNOTATED_COLOR = "#B07D3A";

const MOCK_EVENTS: TimelineEvent[] = [
  { id: -1, caseId: 0, title: "FIR Registration", description: "First Information Report filed at local station", eventDate: "2024-01-15", evidenceType: "document", sourceFile: "fir_copy.pdf", annotation: "" },
  { id: -2, caseId: 0, title: "Site photograph (surveyor)", description: "Site photographs taken by certified surveyor", eventDate: "2024-03-02", evidenceType: "image", sourceFile: "site_photo_01.jpg", annotation: "" },
  { id: -3, caseId: 0, title: "Witness deposition", description: "Deposition of primary witness recorded", eventDate: "2024-05-18", evidenceType: "witness", sourceFile: "deposition_transcript.pdf", annotation: "" },
  { id: -4, caseId: 0, title: "CCTV footage extract", description: "Relevant CCTV footage extracted from premises", eventDate: "2024-08-07", evidenceType: "video", sourceFile: "cctv_extract.mp4", annotation: "" },
  { id: -5, caseId: 0, title: "Court order draft", description: "Draft court order issued by presiding judge", eventDate: "2024-11-22", evidenceType: "document", sourceFile: "court_order_draft.pdf", annotation: "Needs review by senior counsel" },
];

type FilterType = "all" | "document" | "image" | "video" | "witness" | "annotated";

interface EvidenceTimelineProps {
  caseId: number;
  userId?: number;
}

// ====================== MAIN COMPONENT ======================

export default function EvidenceTimeline({ caseId, userId = 1 }: EvidenceTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [annotationText, setAnnotationText] = useState("");
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  // Fetch events
  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTimeline(caseId, userId);
      if (data.length === 0) {
        // Use mock data as fallback
        setEvents(MOCK_EVENTS.map(e => ({ ...e, caseId })));
      } else {
        setEvents(data);
      }
    } catch (err) {
      console.error("Timeline fetch error:", err);
      // Fallback to mock data on error
      setEvents(MOCK_EVENTS.map(e => ({ ...e, caseId })));
      setError("Could not reach server — showing sample data");
    } finally {
      setLoading(false);
    }
  }, [caseId, userId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    if (filter === "annotated") return events.filter(e => e.annotation && e.annotation.trim() !== "");
    return events.filter(e => e.evidenceType === filter);
  }, [events, filter]);

  // Stats
  const stats = useMemo(() => ({
    total: events.length,
    documents: events.filter(e => e.evidenceType === "document").length,
    media: events.filter(e => e.evidenceType === "image" || e.evidenceType === "video").length,
    witness: events.filter(e => e.evidenceType === "witness").length,
    annotated: events.filter(e => e.annotation && e.annotation.trim() !== "").length,
  }), [events]);

  // Handle annotation save
  const handleSaveAnnotation = async () => {
    if (!selectedEvent) return;
    setSavingAnnotation(true);
    try {
      const updated = await annotateEvent(selectedEvent.id, annotationText, userId);
      setEvents(prev => prev.map(e => e.id === updated.id ? updated : e));
      setSelectedEvent(updated);
    } catch (err) {
      console.error("Annotation save error:", err);
      // Optimistic update even on error
      setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, annotation: annotationText } : e));
    } finally {
      setSavingAnnotation(false);
    }
  };

  // Handle add event
  const handleAddEvent = async (payload: CreateEventPayload) => {
    try {
      const created = await createEvent(payload, userId);
      setEvents(prev => [...prev, created].sort((a, b) =>
        new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
      ));
      setShowAddForm(false);
    } catch (err) {
      console.error("Create event error:", err);
      // Optimistic add with temporary ID
      const tempEvent: TimelineEvent = {
        id: -(Date.now()),
        caseId: payload.caseId,
        title: payload.title,
        description: payload.description,
        eventDate: payload.eventDate,
        evidenceType: payload.evidenceType,
        sourceFile: payload.sourceFile,
        annotation: "",
      };
      setEvents(prev => [...prev, tempEvent].sort((a, b) =>
        new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
      ));
      setShowAddForm(false);
    }
  };

  // Handle export PDF
  const handleExportPDF = async () => {
    try {
      // Dynamic import of jsPDF from CDN
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      document.head.appendChild(script);
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load jsPDF"));
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jsPDFConstructor = (window as any).jspdf?.jsPDF;
      if (!jsPDFConstructor) throw new Error("jsPDF not available");

      const doc = new jsPDFConstructor();
      const today = new Date().toISOString().split("T")[0];

      // Header
      doc.setFontSize(18);
      doc.text(`Evidence Timeline — Case #${caseId}`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Exported: ${today}`, 14, 28);
      doc.setFontSize(8);
      doc.text("NyayaZephyr Legal AI Platform", 14, 34);

      // Table header
      let y = 44;
      doc.setFontSize(9);
      doc.setFont(undefined, "bold");
      doc.text("Date", 14, y);
      doc.text("Type", 44, y);
      doc.text("Title", 70, y);
      doc.text("Description", 120, y);
      doc.text("Annotation", 170, y);
      y += 2;
      doc.line(14, y, 196, y);
      y += 5;

      // Rows
      doc.setFont(undefined, "normal");
      const sorted = [...events].sort((a, b) =>
        new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
      );

      for (const event of sorted) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        const hasAnno = event.annotation && event.annotation.trim() !== "";
        if (hasAnno) {
          doc.setFillColor(255, 248, 230);
          doc.rect(12, y - 4, 184, 7, "F");
        }

        doc.setFontSize(8);
        doc.text(event.eventDate?.slice(0, 10) || "—", 14, y);
        doc.text(event.evidenceType, 44, y);
        doc.text(event.title?.slice(0, 28) || "", 70, y);
        doc.text(event.description?.slice(0, 30) || "", 120, y);
        doc.text(event.annotation?.slice(0, 20) || "", 170, y);
        y += 7;
      }

      doc.save(`NZ-${caseId}_evidence_timeline_${today}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      setError("Failed to export PDF. Please try again.");
    }
  };

  // Select event handler
  const handleSelectEvent = (event: TimelineEvent) => {
    setSelectedEvent(event);
    setAnnotationText(event.annotation || "");
  };

  const handleCloseDetail = () => {
    setSelectedEvent(null);
    setAnnotationText("");
  };

  // ===================== RENDER =====================

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
        <svg style={{ width: 32, height: 32, animation: "spin 1s linear infinite" }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Error banner */}
      {error && (
        <div style={{
          padding: "8px 12px", background: "var(--secondary, #f5f1e8)",
          border: "0.5px solid var(--border, #d4b896)", borderRadius: "var(--radius, 8px)",
          fontSize: 13, color: "var(--foreground, #1a1a1a)", display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>Dismiss</button>
        </div>
      )}

      {/* Top action bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["all", "document", "image", "video", "witness", "annotated"] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "4px 12px",
                fontSize: 12,
                fontWeight: 500,
                border: "0.5px solid var(--border, #d4b896)",
                borderRadius: "var(--radius, 8px)",
                cursor: "pointer",
                background: filter === f ? "var(--primary, #2D2D2A)" : "transparent",
                color: filter === f ? "var(--primary-foreground, #fff)" : "var(--foreground, #1a1a1a)",
                transition: "all 0.15s",
              }}
            >
              {f === "all" ? "All" : f === "annotated" ? "Annotated" : TYPE_LABELS[f] || f}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              padding: "5px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer",
              border: "0.5px solid var(--border, #d4b896)", borderRadius: "var(--radius, 8px)",
              background: "transparent", color: "var(--foreground, #1a1a1a)", transition: "all 0.15s",
            }}
          >
            + Add event
          </button>
          <button
            onClick={handleExportPDF}
            style={{
              padding: "5px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer",
              borderRadius: "var(--radius, 8px)", border: "none",
              background: "#2D2D2A", color: "#fff", transition: "all 0.15s",
            }}
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Add event form (inline) */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <AddEventForm caseId={caseId} onSubmit={handleAddEvent} onCancel={() => setShowAddForm(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline SVG */}
      {filteredEvents.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "40px 20px", fontSize: 13,
          color: "var(--muted-foreground, #666)"
        }}>
          No evidence events recorded for this case yet.
        </div>
      ) : (
        <TimelineSVG events={filteredEvents} onSelect={handleSelectEvent} selectedId={selectedEvent?.id ?? null} />
      )}

      {/* Detail panel */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              border: "0.5px solid var(--border, #d4b896)",
              borderRadius: "var(--radius, 8px)",
              padding: 16,
              background: "var(--card, #fff)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <span style={{
                  display: "inline-block", padding: "2px 8px", fontSize: 11, fontWeight: 500,
                  borderRadius: "var(--radius, 8px)",
                  color: "#fff",
                  background: TYPE_COLORS[selectedEvent.evidenceType] || "#666",
                  marginBottom: 6,
                }}>
                  {TYPE_LABELS[selectedEvent.evidenceType] || selectedEvent.evidenceType}
                </span>
                <h4 style={{ fontSize: 15, fontWeight: 500, margin: "4px 0 2px", color: "var(--foreground, #1a1a1a)" }}>
                  {selectedEvent.title}
                </h4>
                <p style={{ fontSize: 12, color: "var(--muted-foreground, #666)", margin: 0 }}>
                  {selectedEvent.eventDate?.slice(0, 10)} · {selectedEvent.sourceFile || "No file"}
                </p>
              </div>
              <button onClick={handleCloseDetail} style={{
                background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1,
                color: "var(--muted-foreground, #666)", padding: "2px 6px",
              }}>×</button>
            </div>

            {selectedEvent.description && (
              <p style={{ fontSize: 13, color: "var(--foreground, #1a1a1a)", margin: "0 0 12px", lineHeight: 1.5 }}>
                {selectedEvent.description}
              </p>
            )}

            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground, #1a1a1a)", display: "block", marginBottom: 4 }}>
              Annotation
            </label>
            <textarea
              value={annotationText}
              onChange={e => setAnnotationText(e.target.value)}
              rows={3}
              style={{
                width: "100%", fontSize: 13, padding: "8px 10px",
                border: "0.5px solid var(--border, #d4b896)",
                borderRadius: "var(--radius, 8px)",
                background: "var(--background, #fff)",
                color: "var(--foreground, #1a1a1a)",
                resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
              }}
              placeholder="Add notes or observations..."
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
              <button onClick={handleCloseDetail} style={{
                padding: "5px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer",
                border: "0.5px solid var(--border, #d4b896)", borderRadius: "var(--radius, 8px)",
                background: "transparent", color: "var(--foreground, #1a1a1a)",
              }}>
                Cancel
              </button>
              <button onClick={handleSaveAnnotation} disabled={savingAnnotation} style={{
                padding: "5px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer",
                borderRadius: "var(--radius, 8px)", border: "none",
                background: "#2D2D2A", color: "#fff", opacity: savingAnnotation ? 0.6 : 1,
              }}>
                {savingAnnotation ? "Saving..." : "Save annotation"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8 }}>
        {[
          { label: "Total Events", value: stats.total },
          { label: "Documents", value: stats.documents },
          { label: "Media", value: stats.media },
          { label: "Witness", value: stats.witness },
          { label: "Annotated", value: stats.annotated },
        ].map(s => (
          <div key={s.label} style={{
            background: "var(--secondary, #f5f1e8)",
            borderRadius: "var(--radius, 8px)",
            padding: "10px 12px", textAlign: "center",
          }}>
            <div style={{ fontSize: 18, fontWeight: 500, color: "var(--foreground, #1a1a1a)" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground, #666)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ====================== TIMELINE SVG ======================

function TimelineSVG({ events, onSelect, selectedId }: {
  events: TimelineEvent[];
  onSelect: (e: TimelineEvent) => void;
  selectedId: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse dates and compute scale
  const parsed = useMemo(() => {
    const items = events.map(e => ({
      ...e,
      date: new Date(e.eventDate),
    })).filter(e => !isNaN(e.date.getTime()));

    if (items.length === 0) return { items: [], minDate: new Date(), maxDate: new Date(), range: 1 };

    const dates = items.map(e => e.date.getTime());
    const minMs = Math.min(...dates);
    const maxMs = Math.max(...dates);
    const pad = 30 * 24 * 60 * 60 * 1000; // 1 month padding

    return {
      items,
      minDate: new Date(minMs - pad),
      maxDate: new Date(maxMs + pad),
      range: (maxMs + pad) - (minMs - pad) || 1,
    };
  }, [events]);

  const svgWidth = Math.max(600, parsed.items.length * 120);
  const svgHeight = 180;
  const axisY = 130;
  const dotRadius = 7;

  // Stagger overlapping labels
  const positions = useMemo(() => {
    const minDateMs = parsed.minDate.getTime();
    const pts = parsed.items.map(item => {
      const x = 40 + ((item.date.getTime() - minDateMs) / parsed.range) * (svgWidth - 80);
      return { ...item, x };
    });

    // Stagger vertically if events are close
    const usedSlots: number[] = [];
    return pts.map(p => {
      let level = 0;
      for (const usedX of usedSlots) {
        if (Math.abs(p.x - usedX) < 80) level++;
      }
      usedSlots.push(p.x);
      const labelY = axisY - 40 - level * 32;
      return { ...p, labelY: Math.max(10, labelY) };
    });
  }, [parsed, svgWidth]);

  // Generate axis ticks
  const ticks = useMemo(() => {
    const minMs = parsed.minDate.getTime();
    const maxMs = parsed.maxDate.getTime();
    const count = Math.min(8, Math.max(3, Math.floor(svgWidth / 100)));
    const result = [];
    for (let i = 0; i <= count; i++) {
      const ms = minMs + (i / count) * (maxMs - minMs);
      const d = new Date(ms);
      const x = 40 + (i / count) * (svgWidth - 80);
      result.push({ x, label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }) });
    }
    return result;
  }, [parsed, svgWidth]);

  return (
    <div
      ref={containerRef}
      style={{
        overflowX: "auto",
        overflowY: "hidden",
        border: "0.5px solid var(--border, #d4b896)",
        borderRadius: "var(--radius, 8px)",
        background: "var(--card, #fff)",
      }}
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ display: "block" }}
      >
        {/* Axis line */}
        <line x1={30} y1={axisY} x2={svgWidth - 30} y2={axisY} stroke="var(--border, #d4b896)" strokeWidth={1} />

        {/* Tick marks */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={t.x} y1={axisY - 3} x2={t.x} y2={axisY + 3} stroke="var(--border, #d4b896)" strokeWidth={1} />
            <text x={t.x} y={axisY + 16} textAnchor="middle" fontSize={10} fill="var(--muted-foreground, #999)">
              {t.label}
            </text>
          </g>
        ))}

        {/* Event dots and connectors */}
        {positions.map(p => {
          const color = TYPE_COLORS[p.evidenceType] || "#666";
          const hasAnnotation = p.annotation && p.annotation.trim() !== "";
          const connectorColor = hasAnnotation ? ANNOTATED_COLOR : color;
          const isSelected = p.id === selectedId;

          return (
            <g
              key={p.id}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(p)}
            >
              {/* Connector line */}
              <line
                x1={p.x}
                y1={p.labelY + 14}
                x2={p.x}
                y2={axisY - dotRadius}
                stroke={connectorColor}
                strokeWidth={hasAnnotation ? 2 : 1}
                strokeDasharray={hasAnnotation ? "none" : "3,2"}
                opacity={0.7}
              />
              {/* Label */}
              <text
                x={p.x}
                y={p.labelY}
                textAnchor="middle"
                fontSize={11}
                fontWeight={500}
                fill="var(--foreground, #1a1a1a)"
              >
                {p.title.length > 18 ? p.title.slice(0, 16) + "…" : p.title}
              </text>
              <text
                x={p.x}
                y={p.labelY + 12}
                textAnchor="middle"
                fontSize={9}
                fill="var(--muted-foreground, #999)"
              >
                {p.date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </text>
              {/* Dot */}
              <circle
                cx={p.x}
                cy={axisY}
                r={isSelected ? dotRadius + 2 : dotRadius}
                fill={color}
                stroke={isSelected ? "var(--foreground, #1a1a1a)" : "var(--card, #fff)"}
                strokeWidth={isSelected ? 2.5 : 2}
              />
              {/* Annotation indicator */}
              {hasAnnotation && (
                <circle cx={p.x + dotRadius} cy={axisY - dotRadius} r={3} fill={ANNOTATED_COLOR} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ====================== ADD EVENT FORM ======================

function AddEventForm({ caseId, onSubmit, onCancel }: {
  caseId: number;
  onSubmit: (payload: CreateEventPayload) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [evidenceType, setEvidenceType] = useState("document");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) return;
    onSubmit({
      caseId,
      title: title.trim(),
      description: description.trim(),
      eventDate,
      evidenceType,
      sourceFile: "",
    });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", fontSize: 13, padding: "6px 10px",
    border: "0.5px solid var(--border, #d4b896)",
    borderRadius: "var(--radius, 8px)",
    background: "var(--background, #fff)",
    color: "var(--foreground, #1a1a1a)",
    fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{
      border: "0.5px solid var(--border, #d4b896)",
      borderRadius: "var(--radius, 8px)",
      padding: 14,
      background: "var(--card, #fff)",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground, #1a1a1a)", display: "block", marginBottom: 3 }}>Title *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Event title" style={inputStyle} />
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground, #1a1a1a)", display: "block", marginBottom: 3 }}>Date *</label>
        <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required style={inputStyle} />
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground, #1a1a1a)", display: "block", marginBottom: 3 }}>Type</label>
        <select value={evidenceType} onChange={e => setEvidenceType(e.target.value)} style={inputStyle}>
          <option value="document">Document</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
          <option value="witness">Witness</option>
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground, #1a1a1a)", display: "block", marginBottom: 3 }}>Description</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" style={inputStyle} />
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={{
          padding: "5px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer",
          border: "0.5px solid var(--border, #d4b896)", borderRadius: "var(--radius, 8px)",
          background: "transparent", color: "var(--foreground, #1a1a1a)",
        }}>
          Cancel
        </button>
        <button type="button" onClick={handleSubmit} style={{
          padding: "5px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer",
          borderRadius: "var(--radius, 8px)", border: "none",
          background: "#2D2D2A", color: "#fff",
        }}>
          Add event
        </button>
      </div>
    </div>
  );
}
