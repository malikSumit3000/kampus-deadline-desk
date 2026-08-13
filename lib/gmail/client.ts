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
  const q = gmailWindowQuery(scanAfter);
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

export function gmailWindowQuery(scanAfter: string) {
  const after = Math.floor(new Date(scanAfter).getTime() / 1000);
  if (!Number.isFinite(after)) throw new Error("invalid_scan_boundary");
  return `after:${after}`;
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
    if (receipt.attempt_count >= 5 || receipt.processing_status === "succeeded") return false;
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

function collectText(part: GmailPart | undefined, plain: string[], html: string[]) {
  if (!part) return;
  const decoded = decodeBody(part.body?.data);
  if (part.mimeType === "text/plain" && decoded) plain.push(decoded);
  if (part.mimeType === "text/html" && decoded) {
    html.push(decoded
      .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<\/(p|div|li|tr|h[1-6])>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">"));
  }
  for (const child of part.parts ?? []) collectText(child, plain, html);
}

function normaliseMessageBody(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 30_000);
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

  const plain: string[] = [];
  const html: string[] = [];
  collectText(message.payload, plain, html);

  return {
    subject: headers.subject ?? "Untitled message",
    sender: headers.from ?? "Unknown sender",
    receivedAt: new Date(Number(message.internalDate)).toISOString(),
    body: normaliseMessageBody((plain.length > 0 ? plain : html).join("\n\n")),
    attachments,
  };
}

export function isSensitiveMessage(summary: ReturnType<typeof summariseMessage>) {
  const subject = summary.subject.toLowerCase();
  const attachments = summary.attachments.join(" ").toLowerCase();
  const body = summary.body.toLowerCase();
  const personalDocument = /\b(resume|cv|transcript|medical|diagnosis|prescription|salary|compensation|ctc)\b|\boffer[\s_-]+(letter|details?|package)\b|\brank[\s_-]+list\b/;
  const individualizedSubject = /\b(shortlist|roster|result|grade|marks|cgpa|transcript|medical|diagnosis|prescription|salary|compensation|ctc)\b|\boffer[\s_-]+(letter|details?|package)\b|\brank[\s_-]+list\b/;
  const individualizedBody = /\b(?:your|individual|confidential)\s+(?:cgpa|grade|marks|rank|salary|compensation|ctc|diagnosis|prescription|offer)\b|\bcgpa\s+transcript\b|\bdiagnosis\s+and\s+prescription\b/;
  return personalDocument.test(attachments) || individualizedSubject.test(subject) || individualizedBody.test(body);
}
