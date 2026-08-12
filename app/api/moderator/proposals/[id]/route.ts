import { NextResponse } from "next/server";
import { parseModeratorDecision } from "@/lib/reliability/rpc-contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { action } = (await request.json()) as { action?: string };
  const decision = parseModeratorDecision(action);
  if (!decision) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "moderator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("resolve_moderator_proposal", {
    p_actor_id: user.id,
    p_proposal_id: id,
    p_action: decision,
  });
  return error
    ? NextResponse.json({ error: "The proposal could not be resolved atomically." }, { status: 409 })
    : NextResponse.json({ ok: true });
}
