const API = "/api/instagram";

export type ApiUser = { id: string; name?: string };
export type IgAccount = {
  id: string;
  name: string;
  username?: string;
  pageId: string;
  pageName: string;
  connected: boolean;
};
export type ConnectedAccount = { id: string; name: string; username?: string };
export type Conversation = {
  id: string;
  updated_time?: string;
  snippet?: string;
  participants?: { data?: Array<{ name?: string }> };
};
export type Message = {
  id: string;
  created_time?: string;
  message?: string;
  from?: { name?: string };
};
export type IgMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  timestamp?: string;
  permalink?: string;
};
export type IgComment = {
  id: string;
  text?: string;
  timestamp?: string;
  username?: string;
  from?: { username?: string };
};
export type CommentEvent = {
  id: string;
  commentId: string;
  text?: string;
  username?: string;
  mediaId?: string;
  receivedAt: number;
  publicReplied?: boolean;
  privateReplied?: boolean;
};
export type AutoReplySettings = {
  publicEnabled: boolean;
  publicMessage: string;
  privateEnabled: boolean;
  privateMessage: string;
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
  jsonFetch<{ user: ApiUser }>(`${API}/session`, {
    method: "POST",
    body: JSON.stringify({ userAccessToken }),
  });
export const apiLogout = () => jsonFetch<{ ok: boolean }>(`${API}/logout`, { method: "POST" });
export const apiListAccounts = () => jsonFetch<{ accounts: IgAccount[] }>(`${API}/accounts`);
export const apiListConnected = () =>
  jsonFetch<{ accounts: ConnectedAccount[] }>(`${API}/accounts/connected`);
export const apiConnect = (id: string) =>
  jsonFetch<{ ok: boolean }>(`${API}/accounts/${encodeURIComponent(id)}/connect`, { method: "POST" });
export const apiDisconnect = (id: string) =>
  jsonFetch<{ ok: boolean }>(`${API}/accounts/${encodeURIComponent(id)}/disconnect`, {
    method: "DELETE",
  });
export const apiListConversations = (accountId: string) =>
  jsonFetch<{ conversations: Conversation[] }>(
    `${API}/accounts/${encodeURIComponent(accountId)}/conversations`
  );
export const apiListMessages = (accountId: string, conversationId: string) =>
  jsonFetch<{ messages: Message[] }>(
    `${API}/accounts/${encodeURIComponent(accountId)}/conversations/${encodeURIComponent(conversationId)}/messages`
  );

export const apiWebhookSetup = () => jsonFetch<WebhookSetup>(`${API}/webhooks/setup`);
export const apiGetCommentSettings = (accountId: string) =>
  jsonFetch<{ autoReply: AutoReplySettings }>(
    `${API}/accounts/${encodeURIComponent(accountId)}/comment-settings`
  );
export const apiUpdateCommentSettings = (accountId: string, settings: AutoReplySettings) =>
  jsonFetch<{ autoReply: AutoReplySettings }>(
    `${API}/accounts/${encodeURIComponent(accountId)}/comment-settings`,
    { method: "PUT", body: JSON.stringify(settings) }
  );
export const apiListCommentEvents = (accountId: string) =>
  jsonFetch<{ events: CommentEvent[] }>(
    `${API}/accounts/${encodeURIComponent(accountId)}/comment-events`
  );
export const apiListMedia = (accountId: string) =>
  jsonFetch<{ media: IgMedia[] }>(`${API}/accounts/${encodeURIComponent(accountId)}/media`);
export const apiListMediaComments = (accountId: string, mediaId: string) =>
  jsonFetch<{ comments: IgComment[] }>(
    `${API}/accounts/${encodeURIComponent(accountId)}/media/${encodeURIComponent(mediaId)}/comments`
  );
export const apiReplyPublic = (accountId: string, commentId: string, message: string) =>
  jsonFetch<{ ok: boolean }>(
    `${API}/accounts/${encodeURIComponent(accountId)}/comments/${encodeURIComponent(commentId)}/reply-public`,
    { method: "POST", body: JSON.stringify({ message }) }
  );
export const apiReplyPrivate = (accountId: string, commentId: string, message: string) =>
  jsonFetch<{ ok: boolean }>(
    `${API}/accounts/${encodeURIComponent(accountId)}/comments/${encodeURIComponent(commentId)}/reply-private`,
    { method: "POST", body: JSON.stringify({ message }) }
  );
