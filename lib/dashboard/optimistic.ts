import type { Agenda } from "@/app/dashboard-data";

type ManualAgendaInput = {
  id: string;
  title: string;
  category: Agenda["category"];
  deadline: string;
  detail: string;
  scope: Agenda["scope"];
  stageId?: string;
};

function displayDate(deadline: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  }).format(new Date(deadline));
}

function countdown(deadline: string) {
  const hours = Math.ceil((new Date(deadline).getTime() - Date.now()) / 3_600_000);
  return hours <= 24 ? `${Math.max(0, hours)}h` : `${Math.ceil(hours / 24)}d`;
}

export function makeManualAgenda(input: ManualAgendaInput): Agenda {
  const label = displayDate(input.deadline);
  const stageId = input.stageId ?? (input.scope === "private" ? `private:${input.id}` : input.id);
  const hours = Math.ceil((new Date(input.deadline).getTime() - Date.now()) / 3_600_000);

  return {
    id: input.id,
    title: input.title,
    category: input.category,
    scope: input.scope,
    urgency: hours <= 24 ? "now" : "soon",
    countdown: countdown(input.deadline),
    deadline: input.deadline,
    displayDate: label,
    detail: input.detail,
    source: input.scope === "private" ? "Added by you" : "Verified by moderator",
    confidence: 1,
    stages: [{
      id: stageId,
      name: input.scope === "private" ? "Personal deadline" : "Deadline",
      deadline: input.deadline,
      displayDate: label,
      status: "to-do",
      note: input.scope === "private" ? "Visible only to you." : "Verified and added by a moderator.",
    }],
  };
}
