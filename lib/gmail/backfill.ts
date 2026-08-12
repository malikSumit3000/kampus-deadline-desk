const BACKFILL_DAYS = 7;

type Receipt = {
  message_id: string;
  processing_status: "processing" | "succeeded" | "failed";
  attempt_count: number;
  updated_at: string;
};

export function initialGmailScanAfter(connectedAt: string) {
  const connected = new Date(connectedAt);
  if (Number.isNaN(connected.getTime())) throw new Error("invalid_connection_time");
  connected.setUTCDate(connected.getUTCDate() - BACKFILL_DAYS);
  return connected.toISOString();
}

export function shouldCompleteBackfill(candidateIds: string[], receipts: Receipt[], processedIds: string[]) {
  const completed = new Set([
    ...receipts.filter((receipt) => receipt.processing_status === "succeeded" || receipt.attempt_count >= 5).map((receipt) => receipt.message_id),
    ...processedIds,
  ]);
  return [...new Set(candidateIds)].every((id) => completed.has(id));
}
