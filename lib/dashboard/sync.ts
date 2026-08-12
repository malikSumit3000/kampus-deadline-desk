type Identified = { id: string };
type DeadlineItem = Identified & { deadline: string };

export type GmailSyncDelta<Agenda extends DeadlineItem, Review extends Identified> = {
  privateAgendas: Agenda[];
  reviews: Review[];
  lastSyncAt: string;
};

function uniqueById<Item extends Identified>(items: Item[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function mergeSyncResult<Agenda extends DeadlineItem, Review extends Identified>(
  current: { agendas: Agenda[]; reviews: Review[] },
  delta: GmailSyncDelta<Agenda, Review>,
) {
  const currentReviewIds = new Set(current.reviews.map((review) => review.id));
  const newReviews = delta.reviews.filter((review) => !currentReviewIds.has(review.id));
  return {
    agendas: uniqueById([...delta.privateAgendas, ...current.agendas])
      .toSorted((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
    reviews: uniqueById([...newReviews, ...current.reviews]),
    lastSyncAt: delta.lastSyncAt,
  };
}
