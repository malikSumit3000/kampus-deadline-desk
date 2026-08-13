export type AdminAccountAction = "block" | "unblock";

export type AdminAccount = {
  id: string;
  name: string;
  email: string;
  role: "student" | "moderator";
  isAdmin: boolean;
  status: "active" | "blocked";
  joinedAt: string;
  gmailConnected: boolean;
  lastSyncAt: string | null;
  syncErrorCode: string | null;
  privateTaskCount: number;
  openReviewCount: number;
};

export function parseAdminAccountAction(value: unknown): AdminAccountAction | null {
  if (!value || typeof value !== "object") return null;
  const action = (value as { action?: unknown }).action;
  return action === "block" || action === "unblock" ? action : null;
}

export function canManageAccount(actorId: string, target: { id: string; isAdmin: boolean }) {
  return actorId !== target.id && !target.isAdmin;
}

export function removalEmailMatches(confirmation: unknown, expectedEmail: string) {
  return typeof confirmation === "string" && confirmation.trim() === expectedEmail;
}

export function sanitizeAdminAccountRow(row: Record<string, unknown>): AdminAccount {
  return {
    id: String(row.id),
    name: String(row.display_name),
    email: String(row.email),
    role: row.role === "moderator" ? "moderator" : "student",
    isAdmin: row.is_admin === true,
    status: row.account_status === "blocked" ? "blocked" : "active",
    joinedAt: String(row.created_at),
    gmailConnected: row.gmail_connected === true,
    lastSyncAt: typeof row.last_sync_at === "string" ? row.last_sync_at : null,
    syncErrorCode: typeof row.sync_error_code === "string" ? row.sync_error_code : null,
    privateTaskCount: Number(row.private_task_count ?? 0),
    openReviewCount: Number(row.open_review_count ?? 0),
  };
}
