import { NextResponse } from "next/server";
import { accountAccessDecision } from "@/lib/auth/account-policy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActiveProfile = {
  id: string;
  email: string;
  display_name: string;
  role: "student" | "moderator";
  is_admin: boolean;
  account_status: "active" | "blocked";
};

export async function getAccountAccess() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, allowed: false as const, status: 401 as const, code: "unauthorized" as const, supabase, user: null };
  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("id,email,display_name,role,is_admin,account_status").eq("id", user.id).maybeSingle();
  const decision = accountAccessDecision(user, profile);
  if (!decision.allowed) return { ok: false as const, ...decision, supabase, user: user ?? null };
  return { ok: true as const, supabase, admin, user: user!, profile: profile as ActiveProfile };
}

export async function requireActiveAccount() {
  const access = await getAccountAccess();
  if (access.ok) return access;
  const message = access.code === "account_blocked" ? "Your Kampus account is blocked." : access.status === 401 ? "Unauthorized" : "Your Kampus profile is unavailable.";
  return { ...access, response: NextResponse.json({ error: message, code: access.code }, { status: access.status }) };
}
