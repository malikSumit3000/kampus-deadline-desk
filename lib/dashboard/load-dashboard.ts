import type { User } from "@supabase/supabase-js";
import type { Agenda, ModeratorProposal, ReviewItem, StageStatus } from "@/app/dashboard-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StageRow = { id: string; stable_key: string; name: string; deadline: string; note: string; position: number };
type SharedAgendaRow = {
  id: string; stable_key: string; title: string; category: Agenda["category"];
  detail: string; source_label: string; confidence: number | string; agenda_stages: StageRow[];
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

function countdown(value: string) {
  const hours = Math.ceil((new Date(value).getTime() - Date.now()) / 3_600_000);
  if (hours <= 24) return `${Math.max(0, hours)}h`;
  return `${Math.ceil(hours / 24)}d`;
}

export async function loadDashboard(user: User) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const [{ data: profile }, { data: shared }, { data: progress }, { data: overrides }, { data: categoryOverrides }, { data: customCategories }, { data: privateItems }, { data: reviews }, { data: connection }] = await Promise.all([
    supabase.from("profiles").select("id,display_name,email,role,is_admin,account_status").eq("id", user.id).single(),
    supabase.from("agendas").select("id,stable_key,title,category,detail,source_label,confidence,agenda_stages(id,stable_key,name,deadline,note,position)").order("created_at"),
    supabase.from("user_progress").select("stage_id,status").eq("user_id", user.id),
    supabase.from("private_deadline_overrides").select("stage_id,deadline").eq("user_id", user.id),
    supabase.from("user_agenda_category_overrides").select("agenda_id,category").eq("user_id", user.id),
    supabase.from("user_categories").select("category").eq("user_id", user.id),
    supabase.from("private_agendas").select("id,title,category,detail,source_label,confidence,deadline,status,private_override").eq("user_id", user.id).order("deadline"),
    supabase.from("review_items").select("id,kind,title,reason,proposed_deadline,received_at,gmail_message_id").eq("user_id", user.id).eq("status", "open").order("received_at", { ascending: false }),
    admin.from("gmail_connections").select("connected_at,last_sync_at,last_error").eq("user_id", user.id).is("revoked_at", null).maybeSingle(),
  ]);

  const progressMap = new Map((progress ?? []).map((item) => [item.stage_id, item.status as StageStatus]));
  const overrideMap = Object.fromEntries((overrides ?? []).map((item) => [item.stage_id, item.deadline]));
  const categoryMap = new Map((categoryOverrides ?? []).map((item) => [item.agenda_id, item.category]));
  const sharedRows = (shared ?? []) as unknown as SharedAgendaRow[];
  const agendas: Agenda[] = sharedRows.map((item) => {
    const stages = [...(item.agenda_stages ?? [])].sort((a, b) => a.position - b.position).map((stage) => ({
      id: stage.id, name: stage.name, deadline: stage.deadline, displayDate: dateLabel(stage.deadline),
      status: progressMap.get(stage.id) ?? "to-do", note: stage.note,
    }));
    const deadline = stages[0]?.deadline ?? new Date().toISOString();
    return {
      id: item.id, title: item.title, category: categoryMap.get(item.id) ?? item.category, scope: "shared" as const,
      urgency: Math.ceil((new Date(deadline).getTime() - Date.now()) / 3_600_000) <= 24 ? "now" as const : "soon" as const,
      countdown: countdown(deadline), deadline, displayDate: dateLabel(deadline), detail: item.detail,
      source: item.source_label, confidence: Number(item.confidence), stages,
    };
  });

  for (const item of privateItems ?? []) {
    agendas.push({
      id: item.id, title: item.title, category: item.category as Agenda["category"], scope: "private",
      urgency: "soon", countdown: countdown(item.deadline), deadline: item.deadline, displayDate: dateLabel(item.deadline),
      detail: item.detail, source: item.source_label, confidence: Number(item.confidence),
      stages: [{ id: `private:${item.id}`, name: "Personal deadline", deadline: item.deadline, displayDate: dateLabel(item.deadline), status: item.status, note: "Visible only to you." }],
    });
    if (item.private_override) overrideMap[`private:${item.id}`] = item.private_override;
  }
  agendas.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  let proposals: ModeratorProposal[] = [];
  if (profile?.role === "moderator") {
    const { data } = await supabase.from("moderator_proposals").select("id,action,title,before_value,proposed_value,source_summary,confidence").eq("status", "open").order("created_at");
    proposals = (data ?? []).map((item) => ({ id: item.id, action: item.action, title: item.title, match: "Pending shared-base decision", before: item.before_value, after: item.proposed_value, source: item.source_summary, confidence: Number(item.confidence) })) as ModeratorProposal[];
  }

  return {
    generatedAt: new Date().toISOString(),
    profile: { id: profile?.id ?? user.id, name: profile?.display_name ?? user.email ?? "Student", email: profile?.email ?? user.email!, role: profile?.role ?? "student", isAdmin: profile?.is_admin === true, accountStatus: profile?.account_status ?? "active" },
    agendas,
    progress: Object.fromEntries(agendas.flatMap((agenda) => agenda.stages.map((stage) => [stage.id, stage.status]))),
    privateDates: overrideMap,
    reviews: (reviews ?? []).map((item) => ({
      id: item.id, kind: item.kind, title: item.title,
      received: dateLabel(item.received_at), reason: item.reason,
      proposedDate: item.proposed_deadline ? dateLabel(item.proposed_deadline) : "No deadline extracted",
      source: item.gmail_message_id ? "Open in Gmail" : "Imported item",
      canAddToDashboard: Boolean(item.proposed_deadline),
    })) as ReviewItem[],
    proposals,
    gmail: { connected: Boolean(connection), lastSyncAt: connection?.last_sync_at ?? null, error: connection?.last_error ?? null },
    availableCategories: [...new Set(["All", "Case Comps", "Committees", "Placements", "Academics", ...(customCategories ?? []).map((item) => item.category), ...(privateItems ?? []).map((item) => item.category), ...categoryMap.values()])],
  };
}
