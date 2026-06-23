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
  apiListReplies,
  apiListThreads,
  apiLogout,
  type ThreadPost,
  type ThreadReply,
  type ThreadsAccount,
} from "./api";
import { RepliesPanel } from "./RepliesPanel";
import { styles } from "./styles";

type RightTab = "posts" | "replies";

export default function App() {
  const appId = import.meta.env.VITE_FB_APP_ID ?? "";
  const configId = import.meta.env.VITE_FB_CONFIG_ID ?? "";

  const [sdkReady, setSdkReady] = useState(false);
  const [user, setUser] = useState<FacebookUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [connected, setConnected] = useState<{ id: string; name: string; username?: string }[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [threads, setThreads] = useState<ThreadPost[]>([]);
  const [selectedThread, setSelectedThread] = useState("");
  const [replies, setReplies] = useState<ThreadReply[]>([]);
  const [rightTab, setRightTab] = useState<RightTab>("posts");

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
    setNotice(null);
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
    setThreads([]);
    setReplies([]);
  }

  useEffect(() => {
    if (!selectedId) {
      setThreads([]);
      setSelectedThread("");
      setReplies([]);
      return;
    }
    setBusy("Loading posts…");
    apiListThreads(selectedId)
      .then((r) => {
        setThreads(r.threads);
        setSelectedThread((p) => p || r.threads[0]?.id || "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !selectedThread) {
      setReplies([]);
      return;
    }
    setBusy("Loading replies…");
    apiListReplies(selectedId, selectedThread)
      .then((r) => setReplies(r.replies))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  }, [selectedId, selectedThread]);

  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, width: 960, maxWidth: "100%" }}>
        <h2 style={{ marginTop: 0 }}>Threads Login POC</h2>
        <p style={styles.subtle}>
          Origin: <code>{origin}</code> · Port <code>5175</code>
        </p>
        {!appId || !configId ? (
          <p style={styles.error}>Set VITE_FB_APP_ID and VITE_FB_CONFIG_ID in threads-app/.env</p>
        ) : null}
        {busy ? <p style={styles.subtle}>{busy}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
        {notice ? <p style={styles.success}>{notice}</p> : null}

        {!user ? (
          <button style={styles.button} disabled={!sdkReady} onClick={handleLogin}>
            Continue with Meta (Threads config)
          </button>
        ) : (
          <div style={styles.grid}>
            <div style={styles.left}>
              <pre style={styles.pre}>{JSON.stringify(user, null, 2)}</pre>
              <h3 style={styles.h3}>Connect Threads profile</h3>
              <p style={styles.subtle}>
                Permissions: <code>threads_basic</code>, <code>threads_manage_replies</code>,{" "}
                <code>threads_content_publish</code>.
              </p>
              {accounts.map((a) => (
                <div key={a.id} style={styles.pageRow}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.pageName}>@{a.username ?? a.name}</div>
                    <div style={styles.subtle}>ID {a.id}</div>
                  </div>
                  {a.connected ? (
                    <button
                      style={styles.smallBtnSec}
                      onClick={() => apiDisconnect(a.id).then(refreshAccounts)}
                    >
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
                <p style={styles.subtle}>
                  No Threads profile found. Add <code>threads_basic</code> to your Business Login config
                  and re-login.
                </p>
              ) : null}
              <button style={styles.buttonSec} onClick={handleLogout}>
                Logout
              </button>
            </div>
            <div style={styles.right}>
              <div style={styles.tabs}>
                <button
                  type="button"
                  style={{ ...styles.tab, ...(rightTab === "posts" ? styles.tabOn : {}) }}
                  onClick={() => setRightTab("posts")}
                >
                  Posts
                </button>
                <button
                  type="button"
                  style={{ ...styles.tab, ...(rightTab === "replies" ? styles.tabOn : {}) }}
                  onClick={() => setRightTab("replies")}
                >
                  Replies
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
                <option value="">Select connected profile…</option>
                {connected.map((a) => (
                  <option key={a.id} value={a.id}>
                    @{a.username ?? a.name}
                  </option>
                ))}
              </select>
              {selectedId && rightTab === "posts" ? (
                <div style={styles.chatGrid}>
                  <div style={styles.threadList}>
                    {threads.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        style={{
                          ...styles.threadBtn,
                          ...(t.id === selectedThread ? styles.threadBtnOn : {}),
                        }}
                        onClick={() => setSelectedThread(t.id)}
                      >
                        <div style={{ fontWeight: 600, fontSize: 12 }}>
                          {t.text?.slice(0, 60) ?? t.id}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div style={styles.messagePane}>
                    {replies.map((r) => (
                      <div key={r.id} style={styles.bubble}>
                        <strong>@{r.username ?? "?"}</strong>
                        <div>{r.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedId && rightTab === "replies" ? (
                <RepliesPanel
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
