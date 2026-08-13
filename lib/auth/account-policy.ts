export type AccountAccessDecision =
  | { allowed: true }
  | { allowed: false; status: 401 | 403; code: "unauthorized" | "account_blocked" | "profile_unavailable" };

export function accountAccessDecision(
  user: { id: string } | null,
  profile: { account_status?: string } | null,
): AccountAccessDecision {
  if (!user) return { allowed: false, status: 401, code: "unauthorized" };
  if (!profile) return { allowed: false, status: 403, code: "profile_unavailable" };
  if (profile.account_status === "blocked") return { allowed: false, status: 403, code: "account_blocked" };
  return { allowed: true };
}
