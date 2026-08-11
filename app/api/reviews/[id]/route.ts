import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const actionStatus: Record<string, string> = { Approved: "approved", "Correction saved": "corrected", Dismissed: "dismissed" };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { action } = (await request.json()) as { action?: string };
  const status = action ? actionStatus[action] : null;
  if (!status) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error } = await supabase.from("review_items").update({ status, resolved_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  return error ? NextResponse.json({ error: "Save failed" }, { status: 400 }) : NextResponse.json({ ok: true });
}

