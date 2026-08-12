type GmailHeader = { name: string; value: string };
type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string };
  parts?: GmailPart[];
};

export type GmailMessage = {
  id: string;
  threadId?: string;
  internalDate: string;
  payload?: GmailPart;
};

export async function refreshGoogleAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error("gmail_token_refresh_failed");
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("gmail_access_token_missing");
  return data.access_token;
}

async function gmailFetch<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`gmail_api_${response.status}`);
  return response.json() as Promise<T>;
}

export async function listCandidateMessageIds(accessToken: string, scanAfter: string) {
  const after = Math.floor(new Date(scanAfter).getTime() / 1000);
  const q = `after:${after} {deadline "due by" submit registration shortlist extension "last date"}`;
  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({ q, maxResults: "50" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await gmailFetch<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(`/messages?${params}`, accessToken);
    ids.push(...(data.messages ?? []).map(({ id }) => id));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return [...new Set(ids)];
}

export function limitSyncCandidates(ids: string[], limit = 10) {
  return [...new Set(ids)].slice(0, Math.min(Math.max(1, limit), 10));
}

type MessageReceipt = {
  message_id: string;
  processing_status: "processing" | "succeeded" | "failed";
  attempt_count: number;
  updated_at: string;
};

export function selectSyncCandidates(ids: string[], receipts: MessageReceipt[], now = new Date()) {
  const byMessageId = new Map(receipts.map((receipt) => [receipt.message_id, receipt]));
  const staleBefore = now.getTime() - 10 * 60 * 1000;
  return limitSyncCandidates(ids.filter((id) => {
    const receipt = byMessageId.get(id);
    if (!receipt) return true;
    if (receipt.attempt_count >= 2 || receipt.processing_status === "succeeded") return false;
    if (receipt.processing_status === "failed") return true;
    return new Date(receipt.updated_at).getTime() < staleBefore;
  }));
}

export async function searchGmailMessageIds(accessToken: string, query: string, maxResults = 10) {
  const params = new URLSearchParams({ q: query, maxResults: String(Math.min(Math.max(1, maxResults), 10)) });
  const data = await gmailFetch<{ messages?: Array<{ id: string }> }>(`/messages?${params}`, accessToken);
  return (data.messages ?? []).map(({ id }) => id);
}

export function getGmailMessage(id: string, accessToken: string) {
  return gmailFetch<GmailMessage>(`/messages/${encodeURIComponent(id)}?format=full`, accessToken);
}

function decodeBody(data?: string) {
  if (!data) return "";
  return Buffer.from(data, "base64url").toString("utf8");
}

function collectText(part?: GmailPart): string[] {
  if (!part) return [];
  const decoded = decodeBody(part.body?.data);
  const own = part.mimeType === "text/plain"
    ? [decoded]
    : part.mimeType === "text/html"
      ? [decoded.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ")]
      : [];
  return own.concat((part.parts ?? []).flatMap(collectText));
}

export function summariseMessage(message: GmailMessage) {
  const headers = Object.fromEntries(
    (message.payload?.headers ?? []).map(({ name, value }) => [name.toLowerCase(), value]),
  );
  const attachments: string[] = [];
  const visit = (part?: GmailPart) => {
    if (!part) return;
    if (part.filename) attachments.push(part.filename);
    part.parts?.forEach(visit);
  };
  visit(message.payload);

  return {
    subject: headers.subject ?? "Untitled message",
    sender: headers.from ?? "Unknown sender",
    receivedAt: new Date(Number(message.internalDate)).toISOString(),
    body: collectText(message.payload).join("\n").replace(/\s+/g, " ").slice(0, 12_000),
    attachments,
  };
}

export function isSensitiveMessage(summary: ReturnType<typeof summariseMessage>) {
  const text = `${summary.subject} ${summary.attachments.join(" ")} ${summary.body}`.toLowerCase();
  return /\b(shortlist|roster|resume|cv|result|grade|marks|medical|salary|cgpa|transcript|compensation|ctc|diagnosis|prescription)\b|\boffer[\s_-]+(letter|details?|package)\b|\brank[\s_-]+list\b/.test(text);
}
