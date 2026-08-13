import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { Agenda, ReviewItem } from "@/app/dashboard-data";
import { requireActiveAccount } from "@/lib/auth/account-guard";
import { makeManualAgenda } from "@/lib/dashboard/optimistic";
import { extractDeadline } from "@/lib/extraction/anthropic";
import { planExtractionMutation, type ExistingDeadlineState } from "@/lib/extraction/context";
import { classifySyncFailure } from "@/lib/extraction/errors";
import { routeExtraction } from "@/lib/extraction/policy";
import { shouldCompleteBackfill } from "@/lib/gmail/backfill";
import { getGmailMessage, isSensitiveMessage, listCandidateMessageIds, refreshGoogleAccessToken, selectSyncCandidates, summariseMessage } from "@/lib/gmail/client";
import { processMessagesIndependently } from "@/lib/gmail/process-batch";
import { parseSyncLease } from "@/lib/reliability/rpc-contracts";
import { logOperationalEvent } from "@/lib/observability/events";
import { decryptToken } from "@/lib/security/token-crypto";

export const maxDuration = 60;

export async function POST() {
  const requestStartedAt = Date.now();
  const syncStartedAt = new Date().toISOString();
  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const { user, admin } = access;
  const { data: connection } = await admin.from("gmail_connections").select("*")
    .eq("user_id", user.id).is("revoked_at", null).maybeSingle();
  if (!connection) return NextResponse.json({ error: "Gmail is not connected" }, { status: 409 });
  const { data: leaseData, error: leaseError } = await admin.rpc("start_gmail_sync", {
    p_user_id: user.id,
    p_lease_seconds: 75,
  });
  if (leaseError) return NextResponse.json({ error: "Could not start sync" }, { status: 500 });
  const lease = parseSyncLease(leaseData);
  if (!lease) {
    logOperationalEvent({ operation: "gmail_sync", status: "blocked", durationMs: Date.now() - requestStartedAt, messagesProcessed: 0, candidatesFound: 0, errorCode: "sync_lease_held" });
    return NextResponse.json({ error: "An inbox refresh is already running." }, { status: 409 });
  }

  let scanned = 0;
  let candidates = 0;
  const processedIds: string[] = [];
  const privateAgendas: Agenda[] = [];
  const newReviews: ReviewItem[] = [];
  try {
    const refreshToken = decryptToken(connection.encrypted_refresh_token, process.env.TOKEN_ENCRYPTION_KEY!);
    const accessToken = await refreshGoogleAccessToken(refreshToken);
    const candidateIds = await listCandidateMessageIds(accessToken, connection.scan_after);
    const { data: receipts, error: receiptsError } = candidateIds.length === 0
      ? { data: [], error: null }
      : await admin.from("gmail_message_receipts")
        .select("message_id,processing_status,attempt_count,updated_at")
        .eq("user_id", user.id)
        .in("message_id", candidateIds);
    if (receiptsError) throw new Error("gmail_receipts_lookup_failed");
    const ids = selectSyncCandidates(candidateIds, receipts ?? []);

    const failures = await processMessagesIndependently(ids, async (id) => {
      const message = await getGmailMessage(id, accessToken);
      const summary = summariseMessage(message);
      const { data: claimed, error: claimError } = await admin.rpc("claim_gmail_message", {
        p_user_id: user.id,
        p_message_id: id,
        p_thread_id: message.threadId ?? null,
        p_internal_date: summary.receivedAt,
      });
      if (claimError) throw new Error("gmail_message_claim_failed");
      if (claimed !== true) return;

      scanned += 1;
      let outcome = "ignored";
      try {
        if (isSensitiveMessage(summary)) {
          outcome = "ignored_sensitive";
        } else {
          const { data: currentRows, error: currentStateError } = await admin.from("private_agendas")
            .select("id,title,category,deadline,source_label")
            .eq("user_id", user.id);
          if (currentStateError) throw new Error("current_deadline_state_failed");
          const currentState: ExistingDeadlineState[] = (currentRows ?? []).map((row) => ({
            id: row.id,
            title: row.title,
            category: row.category,
            deadline: row.deadline,
            source: row.source_label,
          }));
          const extractions = await extractDeadline({ messages: [summary], currentState });
          const datedExtractions = extractions
            .map((extraction, taskIndex) => ({ extraction, taskIndex }))
            .filter(({ extraction }) => routeExtraction(extraction) === "private" && extraction.deadline);
          outcome = datedExtractions.length > 0 ? "private" : "ignored";
          candidates += datedExtractions.length;

          for (const { taskIndex, extraction } of datedExtractions) {
            const mutation = planExtractionMutation(extraction);
            const agendaQuery = mutation.kind === "update"
              ? admin.from("private_agendas").update({
                detail: extraction.detail,
                source_label: summary.sender,
                confidence: extraction.confidence,
                deadline: extraction.deadline!,
                updated_at: new Date().toISOString(),
              }).eq("id", mutation.agendaId).eq("user_id", user.id)
              : admin.from("private_agendas").upsert({
                user_id: user.id,
                gmail_message_id: id,
                gmail_task_index: taskIndex,
                title: extraction.title,
                category: extraction.category,
                detail: extraction.detail,
                source_label: summary.sender,
                confidence: extraction.confidence,
                deadline: extraction.deadline!,
              }, { onConflict: "user_id,gmail_message_id,gmail_task_index", ignoreDuplicates: true });
            const { data: agenda, error: agendaError } = await agendaQuery
              .select("id,title,category,detail,source_label,confidence,deadline,status").maybeSingle();
            if (agendaError) throw new Error("private_agenda_insert_failed");
            if (!agenda) continue;
            privateAgendas.push(makeManualAgenda({
              id: agenda.id,
              title: agenda.title,
              category: agenda.category,
              detail: agenda.detail,
              deadline: agenda.deadline,
              scope: "private",
              source: agenda.source_label,
              confidence: Number(agenda.confidence),
              status: agenda.status,
            }));
          }
        }

        const { error: receiptError } = await admin.from("gmail_message_receipts").update({
          extraction_outcome: outcome,
          processing_status: "succeeded",
          content_hash: createHash("sha256").update(`${summary.subject}\n${summary.body}`).digest("hex"),
          last_error: null,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id).eq("message_id", id);
        if (receiptError) throw new Error("gmail_receipt_update_failed");
        processedIds.push(id);
      } catch (error) {
        const code = error instanceof Error ? error.message.slice(0, 80) : "message_processing_failed";
        await admin.from("gmail_message_receipts").update({
          processing_status: "failed",
          last_error: code,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id).eq("message_id", id);
        throw error;
      }
    });

    const now = new Date().toISOString();
    const windowComplete = shouldCompleteBackfill(candidateIds, receipts ?? [], processedIds);
    const connectionUpdate = windowComplete
      ? { last_sync_at: now, last_error: null, scan_after: syncStartedAt, backfill_completed_at: connection.backfill_completed_at ?? now, updated_at: now }
      : { last_sync_at: now, last_error: null, updated_at: now };
    await Promise.all([
      admin.from("sync_runs").update({ status: "succeeded", finished_at: now, messages_scanned: scanned, candidates_found: candidates }).eq("id", lease.runId),
      admin.from("gmail_connections").update(connectionUpdate).eq("user_id", user.id),
    ]);
    logOperationalEvent({ operation: "gmail_sync", status: "succeeded", durationMs: Date.now() - requestStartedAt, messagesProcessed: scanned, candidatesFound: candidates });
    return NextResponse.json({ scanned, candidates, failed: failures.length, hasMore: !windowComplete && scanned > 0, lastSyncAt: now, privateAgendas, reviews: newReviews });
  } catch (error) {
    const failure = classifySyncFailure(error);
    const now = new Date().toISOString();
    await Promise.all([
      admin.from("sync_runs").update({ status: "failed", finished_at: now, messages_scanned: scanned, candidates_found: candidates, error_code: failure.code }).eq("id", lease.runId),
      admin.from("gmail_connections").update({ last_error: failure.code, updated_at: now }).eq("user_id", user.id),
    ]);
    logOperationalEvent({ operation: "gmail_sync", status: "failed", durationMs: Date.now() - requestStartedAt, messagesProcessed: scanned, candidatesFound: candidates, errorCode: failure.code });
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
