export function agendaAttribution({ source, confidence }: { source: string; confidence: number }) {
  return source === "Added by you"
    ? "Added by you"
    : `${Math.round(confidence * 100)}% extraction confidence`;
}

export function actionContextPreview(detail: string, maxLength = 80) {
  const compact = detail.replace(/\s+/g, " ").trim();
  if (!compact) return "View task details";
  if (compact.length <= maxLength) return compact;
  const clipped = compact.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 40 ? lastSpace : maxLength - 1).replace(/[.,;:]$/, "")}…`;
}

export const reviewActionLabels = ["Mark reviewed", "Mark correction noted", "Dismiss"] as const;

export const moderatorActionLabels = ["Approve proposal", "Mark private", "Reject"] as const;

export function stageProgress(status: "to-do" | "in progress" | "submitted") {
  if (status === "submitted") return { percent: 100, label: "Submitted", tone: "complete" as const };
  if (status === "in progress") return { percent: 50, label: "In progress", tone: "active" as const };
  return { percent: 0, label: "To do", tone: "not-started" as const };
}

type DeadlineAgenda = {
  id: string;
  deadline: string;
  stages: Array<{ id: string; status: "to-do" | "in progress" | "submitted" }>;
};

export function deadlineCountdownLabel(
  agenda: Pick<DeadlineAgenda, "deadline"> & { countdown: string },
  nowMs: number,
) {
  if (new Date(agenda.deadline).getTime() < nowMs) return "Overdue";
  return agenda.countdown.endsWith(" left") ? agenda.countdown : `${agenda.countdown} left`;
}

export function selectUpNext<T extends DeadlineAgenda>(
  agendas: T[],
  stageStates: Record<string, "to-do" | "in progress" | "submitted">,
  nowMs: number,
) {
  return agendas
    .filter((agenda) => {
      if (new Date(agenda.deadline).getTime() < nowMs) return false;
      return agenda.stages.some((stage) => (stageStates[stage.id] ?? stage.status) !== "submitted");
    })
    .toSorted((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0] ?? null;
}
