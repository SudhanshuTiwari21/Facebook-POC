export type ApiUser = {
  id: string;
  name?: string;
  email?: string;
};

export type ApiPage = {
  id: string;
  name: string;
  connected: boolean;
};

export type ConnectedPage = {
  id: string;
  name: string;
};

export type Conversation = {
  id: string;
  updated_time?: string;
  snippet?: string;
  link?: string;
  participants?: { data?: Array<{ name?: string; id?: string }> };
};

export type Message = {
  id: string;
  created_time?: string;
  message?: string;
  from?: { id?: string; name?: string };
  to?: { data?: Array<{ id?: string; name?: string }> };
};

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || undefined),
    },
    credentials: "include",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error ?? `Request failed: ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export function apiCreateSession(userAccessToken: string) {
  return jsonFetch<{ user: ApiUser }>("/api/session", {
    method: "POST",
    body: JSON.stringify({ userAccessToken }),
  });
}

export function apiLogout() {
  return jsonFetch<{ ok: boolean }>("/api/logout", { method: "POST" });
}

export function apiListPages() {
  return jsonFetch<{ pages: ApiPage[] }>("/api/pages");
}

export function apiListConnectedPages() {
  return jsonFetch<{ pages: ConnectedPage[] }>("/api/pages/connected");
}

export function apiConnectPage(pageId: string) {
  return jsonFetch<{ ok: boolean }>(`/api/pages/${encodeURIComponent(pageId)}/connect`, {
    method: "POST",
  });
}

export function apiDisconnectPage(pageId: string) {
  return jsonFetch<{ ok: boolean }>(`/api/pages/${encodeURIComponent(pageId)}/disconnect`, {
    method: "DELETE",
  });
}

export function apiListConversations(pageId: string) {
  return jsonFetch<{ conversations: Conversation[] }>(
    `/api/pages/${encodeURIComponent(pageId)}/conversations`
  );
}

export function apiListMessages(pageId: string, conversationId: string) {
  return jsonFetch<{ messages: Message[] }>(
    `/api/pages/${encodeURIComponent(pageId)}/conversations/${encodeURIComponent(
      conversationId
    )}/messages`
  );
}

