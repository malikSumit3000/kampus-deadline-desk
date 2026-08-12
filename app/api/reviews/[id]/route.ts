import { NextResponse } from "next/server";
import { parseReviewDecision, parseReviewResolution } from "@/lib/reliability/rpc-contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { action } = (await request.json()) as { action?: string };
  const decision = parseReviewDecision(action);
  if (!decision) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createSupabaseAdminClient();
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
