import React, { useEffect, useState } from "react";
import {
  getFacebookAccessToken,
  loginWithFacebook,
  loadFacebookSdk,
  logoutFromFacebook,
  type FacebookUser,
} from "./facebook";
import {
  apiConnectPage,
  apiCreateSession,
  apiDisconnectPage,
  apiListConnectedPages,
  apiListConversations,
  apiListMessages,
  apiListPages,
  apiLogout,
  type ApiPage,
  type ConnectedPage,
  type Conversation,
  type Message,
} from "./api";

export default function App() {
  const appId = (import.meta.env.VITE_FB_APP_ID as string | undefined) ?? "";
  const configId = (import.meta.env.VITE_FB_CONFIG_ID as string | undefined) ?? "";
  const graphVersion =
    (import.meta.env.VITE_FB_GRAPH_VERSION as string | undefined) ?? "v20.0";

  const [sdkReady, setSdkReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<FacebookUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [pages, setPages] = useState<ApiPage[]>([]);
  const [connectedPages, setConnectedPages] = useState<ConnectedPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);

  const redirectOrigin =
    typeof globalThis.window !== "undefined" ? globalThis.window.location.origin : "";

  useEffect(() => {
    if (!appId) return;
    setError(null);
    loadFacebookSdk(appId)
      .then(() => setSdkReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [appId]);

  useEffect(() => {
    if (!sdkReady) return;
    // If the user already logged in previously, reuse the access token.
    getFacebookAccessToken()
      .then((token) => {
        setAccessToken(token);
        if (!token) return;
        return apiCreateSession(token)
          .then(() =>
            fetch(
              `https://graph.facebook.com/${graphVersion}/me?fields=id,name,email&access_token=${token}`
            )
              .then((res) => res.json())
              .then((data) => setUser(data))
          )
          .then(refreshPages)
          .catch((e) => setError(e instanceof Error ? e.message : String(e)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [sdkReady, graphVersion]);

  async function refreshPages() {
    const [all, connected] = await Promise.all([apiListPages(), apiListConnectedPages()]);
    setPages(all.pages);
    setConnectedPages(connected.pages);
    setSelectedPageId((prev) => {
      if (prev && connected.pages.some((p) => p.id === prev)) return prev;
      return connected.pages[0]?.id ?? "";
    });
  }

  async function handleLogin() {
    setError(null);
    try {
      if (!sdkReady) throw new Error("Facebook SDK not ready yet.");
      setBusy("Logging in…");
      const token = await loginWithFacebook(configId);
      setAccessToken(token);
      await apiCreateSession(token);

      const res = await fetch(
        `https://graph.facebook.com/${graphVersion}/me?fields=id,name,email&access_token=${token}`
      );
      const data = await res.json();
      setUser(data);
      await refreshPages();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleLogout() {
    setError(null);
    try {
      setBusy("Logging out…");
      await apiLogout().catch(() => undefined);
      await logoutFromFacebook();
      setAccessToken(null);
      setUser(null);
      setPages([]);
      setConnectedPages([]);
      setSelectedPageId("");
      setConversations([]);
      setSelectedConversationId("");
      setMessages([]);
    } finally {
      setBusy(null);
    }
  }

  async function handleConnect(pageId: string) {
    setError(null);
    try {
      setBusy("Connecting page…");
      await apiConnectPage(pageId);
      await refreshPages();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect(pageId: string) {
    setError(null);
    try {
      setBusy("Disconnecting page…");
      await apiDisconnectPage(pageId);
      await refreshPages();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!selectedPageId) {
      setConversations([]);
      setSelectedConversationId("");
      setMessages([]);
      return;
    }
    setError(null);
    setBusy("Loading conversations…");
    apiListConversations(selectedPageId)
      .then((res) => {
        setConversations(res.conversations);
        setSelectedConversationId((prev) => prev || res.conversations[0]?.id || "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  }, [selectedPageId]);

  useEffect(() => {
    if (!selectedPageId || !selectedConversationId) {
      setMessages([]);
      return;
    }
    setError(null);
    setBusy("Loading messages…");
    apiListMessages(selectedPageId, selectedConversationId)
      .then((res) => setMessages(res.messages))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  }, [selectedPageId, selectedConversationId]);

  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, width: 860 }}>
        <h2 style={{ marginTop: 0 }}>Facebook Login POC (Web)</h2>

        <p style={styles.subtle}>
          Origin: <code>{redirectOrigin}</code>
        </p>

        {!appId || !configId ? (
          <p style={styles.error}>
            Missing <code>VITE_FB_APP_ID</code> or <code>VITE_FB_CONFIG_ID</code>. Copy{" "}
            <code>web-app/.env.example</code> to <code>web-app/.env</code>.
          </p>
        ) : null}

        {busy ? <p style={styles.subtle}>{busy}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}

        {!user ? (
          <button
            style={styles.button}
            disabled={!sdkReady || !appId || !configId}
            onClick={handleLogin}
          >
            Continue with Facebook
          </button>
        ) : (
          <div style={styles.grid}>
            <div style={styles.left}>
              <p style={styles.subtle}>
                Token: ****{accessToken ? accessToken.slice(-8) : ""}
              </p>
              <p style={styles.subtle}>User Info:</p>
              <pre style={styles.pre}>{JSON.stringify(user, null, 2)}</pre>

              <div style={{ marginTop: 16 }}>
                <h3 style={styles.h3}>Connect pages</h3>
                <div style={styles.pagesList}>
                  {pages.map((p) => (
                    <div key={p.id} style={styles.pageRow}>
                      <div style={{ flex: 1 }}>
                        <div style={styles.pageName}>{p.name}</div>
                        <div style={styles.subtle}>Page ID: {p.id}</div>
                      </div>
                      {p.connected ? (
                        <button
                          style={styles.smallButtonSecondary}
                          onClick={() => handleDisconnect(p.id)}
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button style={styles.smallButton} onClick={() => handleConnect(p.id)}>
                          Connect
                        </button>
                      )}
                    </div>
                  ))}
                  {!pages.length ? (
                    <div style={styles.subtle}>
                      No pages returned yet. (This requires Meta permissions like
                      <code> pages_show_list</code>.)
                    </div>
                  ) : null}
                </div>
              </div>

              <button style={styles.buttonSecondary} onClick={handleLogout}>
                Logout
              </button>
            </div>

            <div style={styles.right}>
              <h3 style={styles.h3}>Chats</h3>
              <div style={styles.row}>
                <label style={styles.label}>
                  Page
                  <select
                    style={styles.select}
                    value={selectedPageId}
                    onChange={(e) => setSelectedPageId(e.target.value)}
                  >
                    <option value="" disabled>
                      Select a connected page…
                    </option>
                    {connectedPages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {!selectedPageId ? (
                <div style={styles.subtle}>
                  Connect at least one page, then select it here to load chats.
                </div>
              ) : (
                <div style={styles.chatGrid}>
                  <div style={styles.threadList}>
                    {conversations.map((c) => (
                      <button
                        key={c.id}
                        style={{
                          ...styles.threadButton,
                          ...(c.id === selectedConversationId ? styles.threadButtonActive : null),
                        }}
                        onClick={() => setSelectedConversationId(c.id)}
                      >
                        <div style={styles.threadTitle}>
                          {c.participants?.data
                            ?.map((p) => p.name)
                            .filter(Boolean)
                            .join(", ") || "Conversation"}
                        </div>
                        <div style={styles.threadSnippet}>{c.snippet ?? ""}</div>
                      </button>
                    ))}
                    {!conversations.length ? (
                      <div style={styles.subtle}>
                        No conversations returned. Messenger endpoints typically require
                        additional permissions + app review.
                      </div>
                    ) : null}
                  </div>

                  <div style={styles.messagePane}>
                    {selectedConversationId ? (
                      <div style={styles.messages}>
                        {messages
                          .slice()
                          .reverse()
                          .map((m) => (
                            <div key={m.id} style={styles.messageBubble}>
                              <div style={styles.messageMeta}>
                                <strong>{m.from?.name ?? "Unknown"}</strong>{" "}
                                <span style={styles.messageTime}>{m.created_time ?? ""}</span>
                              </div>
                              <div>{m.message ?? ""}</div>
                            </div>
                          ))}
                        {!messages.length ? <div style={styles.subtle}>No messages.</div> : null}
                      </div>
                    ) : (
                      <div style={styles.subtle}>Select a conversation.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <p style={styles.note}>
          If login fails with “URL blocked”, add your app’s redirect URIs in Meta:
          include your site/origin (above) in <code>Valid OAuth Redirect URIs</code>.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f5f7",
    padding: 16,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  card: {
    width: 520,
    maxWidth: "100%",
    background: "white",
    borderRadius: 12,
    padding: 18,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  },
  button: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    background: "#1877f2",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  },
  buttonSecondary: {
    marginTop: 12,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "white",
    color: "#111",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  },
  subtle: {
    color: "#555",
    fontSize: 13,
    wordBreak: "break-word",
  },
  error: {
    color: "#c00",
    fontSize: 13,
  },
  note: {
    marginTop: 16,
    color: "#666",
    fontSize: 12,
    lineHeight: 1.4,
  },
  pre: {
    margin: 0,
    padding: 12,
    background: "#f7f7f9",
    borderRadius: 10,
    fontSize: 12,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: 16,
    marginTop: 12,
    alignItems: "start",
  },
  left: {
    borderRight: "1px solid #eee",
    paddingRight: 16,
  },
  right: {
    paddingLeft: 4,
  },
  h3: {
    margin: "8px 0 10px",
    fontSize: 14,
  },
  row: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 12,
    color: "#555",
    width: "100%",
  },
  select: {
    height: 36,
    borderRadius: 10,
    border: "1px solid #ddd",
    padding: "0 10px",
    fontSize: 13,
    outline: "none",
  },
  pagesList: {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 10,
    maxHeight: 260,
    overflow: "auto",
    background: "#fafafa",
  },
  pageRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    background: "white",
    border: "1px solid #eee",
    marginBottom: 8,
  },
  pageName: {
    fontWeight: 600,
    fontSize: 13,
    color: "#111",
  },
  smallButton: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "none",
    background: "#1877f2",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
  },
  smallButtonSecondary: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "white",
    color: "#111",
    fontWeight: 600,
    cursor: "pointer",
  },
  chatGrid: {
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    gap: 12,
    minHeight: 360,
  },
  threadList: {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 10,
    overflow: "auto",
    background: "#fafafa",
  },
  threadButton: {
    width: "100%",
    textAlign: "left",
    borderRadius: 10,
    border: "1px solid #eee",
    background: "white",
    padding: 10,
    marginBottom: 8,
    cursor: "pointer",
  },
  threadButtonActive: {
    border: "1px solid #1877f2",
    boxShadow: "0 0 0 2px rgba(24,119,242,0.12)",
  },
  threadTitle: {
    fontWeight: 700,
    fontSize: 12,
    color: "#111",
    marginBottom: 4,
  },
  threadSnippet: {
    fontSize: 12,
    color: "#666",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  messagePane: {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 10,
    background: "white",
    overflow: "auto",
  },
  messages: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  messageBubble: {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 10,
    background: "#f7f7f9",
  },
  messageMeta: {
    fontSize: 12,
    color: "#333",
    marginBottom: 6,
    display: "flex",
    alignItems: "baseline",
    gap: 8,
  },
  messageTime: {
    color: "#777",
    fontSize: 11,
  },
};

