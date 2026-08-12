function firstRow(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value) || !value[0] || typeof value[0] !== "object") return null;
  return value[0] as Record<string, unknown>;
}

export function parseSyncLease(value: unknown) {
  const row = firstRow(value);
  return row?.acquired === true && typeof row.run_id === "string"
    ? { runId: row.run_id }
    : null;
}

export function parseAllowanceResult(value: unknown) {
  const row = firstRow(value);
  if (!row || typeof row.allowed !== "boolean" || typeof row.used !== "number" || typeof row.remaining !== "number") return null;
  if (row.audit_id !== null && typeof row.audit_id !== "number") return null;
  return {
    allowed: row.allowed,
    auditId: row.audit_id as number | null,
    used: row.used,
    remaining: row.remaining,
  };
}

export type ModeratorDecision = "approve" | "private" | "reject";

export function parseModeratorDecision(value: unknown): ModeratorDecision | null {
  return value === "approve" || value === "private" || value === "reject" ? value : null;
}

export type ReviewDecision = "approve" | "correct" | "dismiss";

export function parseReviewDecision(value: unknown): ReviewDecision | null {
  return value === "approve" || value === "correct" || value === "dismiss" ? value : null;
}

type ReviewAgenda = {
  id: string;
  title: string;
  category: string;
  detail: string;
  source: string;
  confidence: number;
  deadline: string;
  status: "to-do" | "in progress" | "submitted";
};

export function parseReviewResolution(value: unknown): { status: "approved" | "corrected" | "dismissed"; agenda: ReviewAgenda | null } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.status !== "approved" && row.status !== "corrected" && row.status !== "dismissed") return null;
  if (row.status !== "approved") return row.agenda === null ? { status: row.status, agenda: null } : null;
  if (!row.agenda || typeof row.agenda !== "object" || Array.isArray(row.agenda)) return null;
  const agenda = row.agenda as Record<string, unknown>;
  if (
    typeof agenda.id !== "string" || typeof agenda.title !== "string" || typeof agenda.category !== "string"
    || typeof agenda.detail !== "string" || typeof agenda.source_label !== "string"
    || typeof agenda.confidence !== "number" || typeof agenda.deadline !== "string"
    || (agenda.status !== "to-do" && agenda.status !== "in progress" && agenda.status !== "submitted")
  ) return null;
  return {
    status: row.status,
    agenda: {
      id: agenda.id,
      title: agenda.title,
      category: agenda.category,
      detail: agenda.detail,
      source: agenda.source_label,
      confidence: agenda.confidence,
      deadline: agenda.deadline,
      status: agenda.status,
    },
  };
}
