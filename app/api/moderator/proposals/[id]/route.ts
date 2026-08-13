import { NextResponse } from "next/server";
import { parseModeratorDecision } from "@/lib/reliability/rpc-contracts";
import { requireActiveAccount } from "@/lib/auth/account-guard";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { action } = (await request.json()) as { action?: string };
  const decision = parseModeratorDecision(action);
  if (!decision) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const { id } = await params;
  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const { user, profile, admin } = access;
  if (profile.role !== "moderator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { error } = await admin.rpc("resolve_moderator_proposal", {
    p_actor_id: user.id,
    p_proposal_id: id,
    p_action: decision,
  });
  return error
    ? NextResponse.json({ error: "The proposal could not be resolved atomically." }, { status: 409 })
    : NextResponse.json({ ok: true });
}
