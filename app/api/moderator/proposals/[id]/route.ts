import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProposalPayload = {
  deadline?: string | null;
  title?: string;
  category?: string;
  detail?: string;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { action } = (await request.json()) as { action?: string };
  const status = action === "Rejected" ? "rejected" : action === "Marked private" ? "private" : action ? "approved" : null;
  if (!status) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "moderator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const { data: proposal } = await admin.from("moderator_proposals").select("*").eq("id", id).eq("status", "open").maybeSingle();
  if (!proposal) return NextResponse.json({ error: "Proposal is no longer open" }, { status: 409 });
  const payload = proposal.payload as ProposalPayload;

  if (status === "approved") {
    if (!payload.deadline) return NextResponse.json({ error: "Proposal has no usable deadline" }, { status: 409 });
    if (proposal.action === "new") {
      const { data: agenda, error } = await admin.from("agendas").insert({
        stable_key: `gmail-${proposal.id}`,
        title: payload.title ?? proposal.title,
        category: payload.category ?? "Academics",
        detail: payload.detail ?? "Approved from a batch announcement.",
        source_label: proposal.source_summary,
        confidence: proposal.confidence,
        created_by: user.id,
        approved_at: new Date().toISOString(),
      }).select("id").single();
      if (error || !agenda) return NextResponse.json({ error: "Could not create shared agenda" }, { status: 400 });
      await admin.from("agenda_stages").insert({ agenda_id: agenda.id, stable_key: `gmail-stage-${proposal.id}`, name: "Deadline", deadline: payload.deadline, note: "Approved by an IIMK moderator.", position: 1 });
    } else if (proposal.matched_stage_id) {
      const { error } = await admin.from("agenda_stages").update({ deadline: payload.deadline, updated_at: new Date().toISOString() }).eq("id", proposal.matched_stage_id);
      if (error) return NextResponse.json({ error: "Could not update shared deadline" }, { status: 400 });
    } else {
      return NextResponse.json({ error: "Choose a matching shared stage before approving this change" }, { status: 409 });
    }
  } else if (status === "private" && proposal.submitted_by && payload.deadline) {
    await admin.from("private_agendas").insert({
      user_id: proposal.submitted_by,
      title: payload.title ?? proposal.title,
      category: payload.category ?? "Academics",
      detail: payload.detail ?? "Marked private by a moderator.",
      source_label: proposal.source_summary,
      confidence: proposal.confidence,
      deadline: payload.deadline,
    });
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("moderator_proposals").update({ status, resolved_at: now, resolved_by: user.id }).eq("id", id);
  if (error) return NextResponse.json({ error: "Save failed" }, { status: 400 });
  await admin.from("audit_events").insert({ actor_id: user.id, event_type: `proposal.${status}`, target_type: "moderator_proposal", target_id: id });
  return NextResponse.json({ ok: true });
}

