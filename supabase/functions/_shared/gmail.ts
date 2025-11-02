import { requireEnv } from "./util.ts";

const GOOGLE_OAUTH_CLIENT_ID = requireEnv("GOOGLE_OAUTH_CLIENT_ID");
const GOOGLE_OAUTH_CLIENT_SECRET = requireEnv("GOOGLE_OAUTH_CLIENT_SECRET");

export interface GmailTokenPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt?: string | null;
}

export interface GmailMessageList {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
}

export async function refreshGmailAccessToken(refreshToken: string) {
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh Gmail token: ${text}`);
  }

  const json = await response.json();
  return {
    accessToken: json.access_token as string,
    expiresIn: json.expires_in as number,
  };
}

export async function gmailFetch<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail API error for ${path}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function listRecentMessages(accessToken: string, query = "-in:drafts") {
  return gmailFetch<GmailMessageList>(accessToken, `users/me/messages?maxResults=20&q=${encodeURIComponent(query)}`);
}

export interface GmailMessagePayload {
  id: string;
  threadId: string;
  snippet: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: GmailMessagePayload["payload"][];
    mimeType?: string;
  };
}

function decodeBase64url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(normalized);
  const decoder = new TextDecoder();
  const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
  return decoder.decode(bytes);
}

export function extractPlainText(payload?: GmailMessagePayload["payload"]): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64url(payload.body.data);
  }

  if (payload.parts?.length) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }

  return "";
}

export function extractHtml(payload?: GmailMessagePayload["payload"]): string {
  if (!payload) return "";
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64url(payload.body.data);
  }
  if (payload.parts?.length) {
    for (const part of payload.parts) {
      const html = extractHtml(part);
      if (html) return html;
    }
  }
  return "";
}

export async function getMessage(accessToken: string, messageId: string) {
  return gmailFetch<GmailMessagePayload>(accessToken, `users/me/messages/${messageId}?format=full`);
}

export async function archiveMessage(accessToken: string, messageId: string) {
  await gmailFetch(accessToken, `users/me/messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify({
      removeLabelIds: ["INBOX"],
    }),
  });
}

export async function moveMessageToTrash(accessToken: string, messageId: string) {
  await gmailFetch(accessToken, `users/me/messages/${messageId}/trash`, {
    method: "POST",
    body: "{}",
  });
}
