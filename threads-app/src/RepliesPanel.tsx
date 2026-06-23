import React, { useEffect, useState } from "react";
import {
  apiGetReplySettings,
  apiHideReply,
  apiListReplies,
  apiListReplyEvents,
  apiListThreads,
  apiPostReply,
  apiUpdateReplySettings,
  apiWebhookSetup,
  type AutoReplySettings,
  type ReplyEvent,
  type ThreadPost,
  type ThreadReply,
  type WebhookSetup,
} from "./api";
import { styles } from "./styles";

type Props = {
  accountId: string;
  onError: (msg: string) => void;
  onNotice: (msg: string) => void;
  busy: string | null;
  setBusy: (msg: string | null) => void;
};

export function RepliesPanel({ accountId, onError, onNotice, busy, setBusy }: Props) {
  const [webhook, setWebhook] = useState<WebhookSetup | null>(null);
  const [autoReply, setAutoReply] = useState<AutoReplySettings>({
    enabled: false,
    message: "Thanks for your reply! 🙏",
  });
  const [events, setEvents] = useState<ReplyEvent[]>([]);
  const [threads, setThreads] = useState<ThreadPost[]>([]);
  const [selectedThread, setSelectedThread] = useState("");
  const [replies, setReplies] = useState<ThreadReply[]>([]);
  const [selectedReply, setSelectedReply] = useState("");
  const [replyText, setReplyText] = useState("Thanks for reaching out!");

  useEffect(() => {
    if (!accountId) return;
    Promise.all([apiWebhookSetup(), apiGetReplySettings(accountId), apiListReplyEvents(accountId)])
      .then(([wh, settings, ev]) => {
        setWebhook(wh);
        setAutoReply(settings.autoReply);
        setEvents(ev.events);
      })
      .catch((e) => onError(e instanceof Error ? e.message : String(e)));
  }, [accountId, onError]);

  useEffect(() => {
    if (!accountId) return;
    setBusy("Loading posts…");
    apiListThreads(accountId)
      .then((r) => {
        setThreads(r.threads);
        setSelectedThread((p) => p || r.threads[0]?.id || "");
      })
      .catch((e) => onError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  }, [accountId, onError, setBusy]);

  useEffect(() => {
    if (!accountId || !selectedThread) {
      setReplies([]);
      return;
    }
    setBusy("Loading replies…");
    apiListReplies(accountId, selectedThread)
      .then((r) => {
        setReplies(r.replies);
        setSelectedReply((p) => p || r.replies[0]?.id || "");
      })
      .catch((e) => onError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  }, [accountId, selectedThread, onError, setBusy]);

  async function saveAutoReply() {
    setBusy("Saving auto-reply…");
    try {
      const { autoReply: saved } = await apiUpdateReplySettings(accountId, autoReply);
      setAutoReply(saved);
      onNotice("Auto-reply settings saved.");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function refreshEvents() {
    const ev = await apiListReplyEvents(accountId);
    setEvents(ev.events);
  }

  return (
    <div>
      <h3 style={styles.h3}>Reply management</h3>

      {webhook ? (
        <div style={styles.webhookBox}>
          <p style={styles.subtle}>
            <strong>Webhook URL</strong> (Meta → Webhooks → Threads):
          </p>
          <code style={styles.code}>{webhook.callbackUrl}</code>
          <p style={styles.subtle}>
            <strong>Verify token:</strong> <code>{webhook.verifyToken}</code>
          </p>
          <p style={styles.subtle}>
            Subscribe fields: <code>{webhook.subscribedFields.join(", ")}</code>
          </p>
        </div>
      ) : null}

      <div style={styles.webhookBox}>
        <p style={styles.subtle}>
          <strong>Auto-reply on new reply</strong> (via webhook). Requires{" "}
          <code>threads_manage_replies</code> + <code>threads_content_publish</code>.
        </p>
        <label style={styles.checkRow}>
          <input
            type="checkbox"
            checked={autoReply.enabled}
            onChange={(e) => setAutoReply({ ...autoReply, enabled: e.target.checked })}
          />
          Reply automatically to new replies
        </label>
        <input
          style={styles.input}
          value={autoReply.message}
          onChange={(e) => setAutoReply({ ...autoReply, message: e.target.value })}
        />
        <button type="button" style={styles.smallBtn} onClick={saveAutoReply} disabled={!!busy}>
          Save auto-reply
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={styles.rowBetween}>
          <strong style={{ fontSize: 13 }}>Webhook events</strong>
          <button type="button" style={styles.smallBtnSec} onClick={refreshEvents}>
            Refresh
          </button>
        </div>
        {events.length === 0 ? (
          <p style={styles.subtle}>No webhook replies yet. Reply to a post to test.</p>
        ) : (
          events.slice(0, 8).map((ev) => (
            <div key={ev.id} style={styles.pageRow}>
              <div style={{ flex: 1 }}>
                <div style={styles.pageName}>@{ev.username ?? "?"}</div>
                <div style={styles.subtle}>{ev.text}</div>
                <div style={styles.subtle}>{ev.autoReplied ? "✓ auto-replied" : ""}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #eee" }} />

      <p style={styles.subtle}>
        <strong>Manual actions</strong> — reply to or hide replies on your posts:
      </p>
      <select
        style={styles.select}
        value={selectedThread}
        onChange={(e) => setSelectedThread(e.target.value)}
      >
        <option value="">Select post…</option>
        {threads.map((t) => (
          <option key={t.id} value={t.id}>
            {(t.text ?? t.id).slice(0, 50)}
          </option>
        ))}
      </select>

      <div style={styles.chatGrid}>
        <div style={styles.threadList}>
          {replies.map((r) => (
            <button
              key={r.id}
              type="button"
              style={{
                ...styles.threadBtn,
                ...(r.id === selectedReply ? styles.threadBtnOn : {}),
              }}
              onClick={() => setSelectedReply(r.id)}
            >
              <div>@{r.username ?? "?"}</div>
              <div style={styles.subtle}>{r.text}</div>
            </button>
          ))}
        </div>
        <div style={styles.messagePane}>
          <textarea
            style={{ ...styles.input, minHeight: 60, width: "100%" }}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={styles.smallBtn}
              disabled={!selectedThread || !!busy}
              onClick={() =>
                apiPostReply(accountId, selectedThread, replyText)
                  .then(() => onNotice("Reply posted."))
                  .catch((e) => onError(e.message))
              }
            >
              Post reply
            </button>
            <button
              type="button"
              style={styles.smallBtnSec}
              disabled={!selectedReply || !!busy}
              onClick={() =>
                apiHideReply(accountId, selectedReply, true)
                  .then(() => onNotice("Reply hidden."))
                  .catch((e) => onError(e.message))
              }
            >
              Hide reply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
