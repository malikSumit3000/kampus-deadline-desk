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
