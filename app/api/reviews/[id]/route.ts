import { NextResponse } from "next/server";
import { parseReviewDecision, parseReviewResolution } from "@/lib/reliability/rpc-contracts";
import { requireActiveAccount } from "@/lib/auth/account-guard";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { action } = (await request.json()) as { action?: string };
  const decision = parseReviewDecision(action);
  if (!decision) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const { id } = await params;
  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const { user, admin } = access;
  const { data, error } = await admin.rpc("resolve_review_item", {
    p_actor_id: user.id,
    p_review_id: id,
    p_action: decision,
  });
  const result = parseReviewResolution(data);
  return error || !result
    ? NextResponse.json({ error: "The review could not be resolved." }, { status: 409 })
    : NextResponse.json({ ok: true, ...result });
}
