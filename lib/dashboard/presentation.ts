export function agendaAttribution({ source, confidence }: { source: string; confidence: number }) {
  return source === "Added by you"
    ? "Added by you"
    : `${Math.round(confidence * 100)}% extraction confidence`;
}

export const reviewActionLabels = ["Mark reviewed", "Mark correction noted", "Dismiss"] as const;

export const moderatorActionLabels = ["Approve proposal", "Mark private", "Reject"] as const;
