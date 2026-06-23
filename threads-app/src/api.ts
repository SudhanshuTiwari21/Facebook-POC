const API = "/api/threads";

export type ApiUser = { id: string; name?: string };
export type ThreadsAccount = {
  id: string;
  username?: string;
  name: string;
  connected: boolean;
};
export type ConnectedAccount = { id: string; username?: string; name?: string };
export type ThreadPost = {
  id: string;
  text?: string;
  timestamp?: string;
  permalink?: string;
};
export type ThreadReply = {
  id: string;
  text?: string;
  timestamp?: string;
  username?: string;
};
export type ReplyEvent = {
  id: string;
  replyId: string;
  text?: string;
  username?: string;
  threadId?: string;
  receivedAt: number;
  autoReplied?: boolean;
};
export type AutoReplySettings = {
  enabled: boolean;
  message: string;
};
export type WebhookSetup = {
  callbackUrl: string;
  verifyToken: string;
  subscribedFields: string[];
};

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || undefined) },
    credentials: "include",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error ?? `Request failed: ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const apiCreateSession = (userAccessToken: string) =>
  jsonFetch<{ user: ApiUser; threadsProfile?: { id: string; username?: string } | null }>(
    `${API}/session`,
    { method: "POST", body: JSON.stringify({ userAccessToken }) }
  );
export const apiLogout = () => jsonFetch<{ ok: boolean }>(`${API}/logout`, { method: "POST" });
export const apiListAccounts = () => jsonFetch<{ accounts: ThreadsAccount[] }>(`${API}/accounts`);
export const apiListConnected = () =>
  jsonFetch<{ accounts: ConnectedAccount[] }>(`${API}/accounts/connected`);
export const apiConnect = (id: string) =>
  jsonFetch<{ ok: boolean }>(`${API}/accounts/${encodeURIComponent(id)}/connect`, {
    method: "POST",
  });
export const apiDisconnect = (id: string) =>
  jsonFetch<{ ok: boolean }>(`${API}/accounts/${encodeURIComponent(id)}/disconnect`, {
    method: "DELETE",
  });
export const apiListThreads = (accountId: string) =>
  jsonFetch<{ threads: ThreadPost[] }>(`${API}/accounts/${encodeURIComponent(accountId)}/threads`);
export const apiListReplies = (accountId: string, threadId: string) =>
  jsonFetch<{ replies: ThreadReply[] }>(
    `${API}/accounts/${encodeURIComponent(accountId)}/threads/${encodeURIComponent(threadId)}/replies`
  );
export const apiPostReply = (accountId: string, threadId: string, message: string) =>
  jsonFetch<{ ok: boolean }>(
    `${API}/accounts/${encodeURIComponent(accountId)}/threads/${encodeURIComponent(threadId)}/reply`,
    { method: "POST", body: JSON.stringify({ message }) }
  );
export const apiHideReply = (accountId: string, replyId: string, hide = true) =>
  jsonFetch<{ ok: boolean }>(
    `${API}/accounts/${encodeURIComponent(accountId)}/replies/${encodeURIComponent(replyId)}/hide`,
    { method: "POST", body: JSON.stringify({ hide }) }
  );
export const apiWebhookSetup = () => jsonFetch<WebhookSetup>(`${API}/webhooks/setup`);
export const apiGetReplySettings = (accountId: string) =>
  jsonFetch<{ autoReply: AutoReplySettings }>(
    `${API}/accounts/${encodeURIComponent(accountId)}/reply-settings`
  );
export const apiUpdateReplySettings = (accountId: string, settings: AutoReplySettings) =>
  jsonFetch<{ autoReply: AutoReplySettings }>(
    `${API}/accounts/${encodeURIComponent(accountId)}/reply-settings`,
    { method: "PUT", body: JSON.stringify(settings) }
  );
export const apiListReplyEvents = (accountId: string) =>
  jsonFetch<{ events: ReplyEvent[] }>(
    `${API}/accounts/${encodeURIComponent(accountId)}/reply-events`
  );
