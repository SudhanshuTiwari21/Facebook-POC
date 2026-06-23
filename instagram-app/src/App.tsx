import React, { useEffect, useState } from "react";
import {
  getFacebookAccessToken,
  loginWithFacebook,
  loadFacebookSdk,
  logoutFromFacebook,
  type FacebookUser,
} from "./facebook";
import {
  apiConnect,
  apiCreateSession,
  apiDisconnect,
  apiListAccounts,
  apiListConnected,
  apiListConversations,
  apiListMessages,
  apiLogout,
  type Conversation,
  type IgAccount,
  type Message,
} from "./api";
import { CommentsPanel } from "./CommentsPanel";
import { styles } from "./styles";

type RightTab = "dms" | "comments";

export default function App() {
  const appId = import.meta.env.VITE_FB_APP_ID ?? "";
  const configId = import.meta.env.VITE_FB_CONFIG_ID ?? "";

  const [sdkReady, setSdkReady] = useState(false);
  const [user, setUser] = useState<FacebookUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<IgAccount[]>([]);
  const [connected, setConnected] = useState<{ id: string; name: string }[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [rightTab, setRightTab] = useState<RightTab>("dms");
  const [notice, setNotice] = useState<string | null>(null);

  const origin =
    typeof globalThis.window !== "undefined" ? globalThis.window.location.origin : "";

  useEffect(() => {
    if (!appId) return;
    loadFacebookSdk(appId).then(() => setSdkReady(true)).catch((e) => setError(String(e)));
  }, [appId]);

  async function refreshAccounts() {
    const [all, conn] = await Promise.all([apiListAccounts(), apiListConnected()]);
    setAccounts(all.accounts);
    setConnected(conn.accounts);
    setSelectedId((prev) =>
      prev && conn.accounts.some((a) => a.id === prev) ? prev : conn.accounts[0]?.id ?? ""
    );
  }

  useEffect(() => {
    if (!sdkReady) return;
    getFacebookAccessToken()
      .then(async (token) => {
        if (!token) return;
        const { user: u } = await apiCreateSession(token);
        setUser(u);
        await refreshAccounts();
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [sdkReady]);

  async function handleLogin() {
    setError(null);
    setBusy("Logging in…");
    try {
      const token = await loginWithFacebook(configId);
      const { user: u } = await apiCreateSession(token);
      setUser(u);
      await refreshAccounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleLogout() {
    await apiLogout().catch(() => undefined);
    await logoutFromFacebook();
    setUser(null);
    setAccounts([]);
    setConnected([]);
    setSelectedId("");
    setConversations([]);
    setMessages([]);
  }

  useEffect(() => {
    if (!selectedId) {
      setConversations([]);
      setSelectedConv("");
      setMessages([]);
      return;
    }
    setBusy("Loading DMs…");
    apiListConversations(selectedId)
      .then((r) => {
        setConversations(r.conversations);
        setSelectedConv((p) => p || r.conversations[0]?.id || "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !selectedConv) {
      setMessages([]);
      return;
    }
    setBusy("Loading messages…");
    apiListMessages(selectedId, selectedConv)
      .then((r) => setMessages(r.messages))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  }, [selectedId, selectedConv]);

  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, width: 960, maxWidth: "100%" }}>
        <h2 style={{ marginTop: 0 }}>Instagram Login POC</h2>
        <p style={styles.subtle}>
          Origin: <code>{origin}</code> · Port <code>5174</code>
        </p>
        {!appId || !configId ? (
          <p style={styles.error}>Set VITE_FB_APP_ID and VITE_FB_CONFIG_ID in instagram-app/.env</p>
        ) : null}
        {busy ? <p style={styles.subtle}>{busy}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
        {notice ? <p style={styles.success}>{notice}</p> : null}

        {!user ? (
          <button style={styles.button} disabled={!sdkReady} onClick={handleLogin}>
            Continue with Meta (Instagram config)
          </button>
        ) : (
          <div style={styles.grid}>
            <div style={styles.left}>
              <pre style={styles.pre}>{JSON.stringify(user, null, 2)}</pre>
              <h3 style={styles.h3}>Connect Instagram accounts</h3>
              <p style={styles.subtle}>
                Requires IG Professional linked to a Facebook Page. Permissions:{" "}
                <code>instagram_basic</code>, <code>instagram_manage_messages</code>,{" "}
                <code>instagram_manage_comments</code>, <code>pages_messaging</code>,{" "}
                <code>pages_show_list</code>.
              </p>
              {accounts.map((a) => (
                <div key={a.id} style={styles.pageRow}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.pageName}>@{a.username ?? a.name}</div>
                    <div style={styles.subtle}>
                      Page: {a.pageName} · ID {a.id}
                    </div>
                  </div>
                  {a.connected ? (
                    <button style={styles.smallBtnSec} onClick={() => apiDisconnect(a.id).then(refreshAccounts)}>
                      Disconnect
                    </button>
                  ) : (
                    <button style={styles.smallBtn} onClick={() => apiConnect(a.id).then(refreshAccounts)}>
                      Connect
                    </button>
                  )}
                </div>
              ))}
              {!accounts.length ? (
                <p style={styles.subtle}>No Instagram business accounts found on your Pages.</p>
              ) : null}
              <button style={styles.buttonSec} onClick={handleLogout}>
                Logout
              </button>
            </div>
            <div style={styles.right}>
              <div style={styles.tabs}>
                <button
                  type="button"
                  style={{ ...styles.tab, ...(rightTab === "dms" ? styles.tabOn : {}) }}
                  onClick={() => setRightTab("dms")}
                >
                  DMs
                </button>
                <button
                  type="button"
                  style={{ ...styles.tab, ...(rightTab === "comments" ? styles.tabOn : {}) }}
                  onClick={() => setRightTab("comments")}
                >
                  Comments
                </button>
              </div>
              <select
                style={styles.select}
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setNotice(null);
                  setError(null);
                }}
              >
                <option value="">Select connected account…</option>
                {connected.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {selectedId && rightTab === "dms" ? (
                <div style={styles.chatGrid}>
                  <div style={styles.threadList}>
                    {conversations.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        style={{
                          ...styles.threadBtn,
                          ...(c.id === selectedConv ? styles.threadBtnOn : {}),
                        }}
                        onClick={() => setSelectedConv(c.id)}
                      >
                        <div>{c.snippet ?? "Conversation"}</div>
                      </button>
                    ))}
                  </div>
                  <div style={styles.messagePane}>
                    {messages
                      .slice()
                      .reverse()
                      .map((m) => (
                        <div key={m.id} style={styles.bubble}>
                          <strong>{m.from?.name ?? "?"}</strong>
                          <div>{m.message}</div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
              {selectedId && rightTab === "comments" ? (
                <CommentsPanel
                  accountId={selectedId}
                  onError={setError}
                  onNotice={setNotice}
                  busy={busy}
                  setBusy={setBusy}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
