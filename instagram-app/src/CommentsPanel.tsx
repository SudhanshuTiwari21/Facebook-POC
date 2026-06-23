import React, { useEffect, useState } from "react";
import {
  apiGetCommentSettings,
  apiListCommentEvents,
  apiListMedia,
  apiListMediaComments,
  apiReplyPrivate,
  apiReplyPublic,
  apiUpdateCommentSettings,
  apiWebhookSetup,
  type AutoReplySettings,
  type CommentEvent,
  type IgComment,
  type IgMedia,
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

export function CommentsPanel({ accountId, onError, onNotice, busy, setBusy }: Props) {
  const [webhook, setWebhook] = useState<WebhookSetup | null>(null);
  const [autoReply, setAutoReply] = useState<AutoReplySettings>({
    publicEnabled: false,
    publicMessage: "Thanks for your comment! 🙏",
    privateEnabled: false,
    privateMessage: "Thanks for commenting! Check your DMs.",
  });
  const [events, setEvents] = useState<CommentEvent[]>([]);
  const [media, setMedia] = useState<IgMedia[]>([]);
  const [selectedMedia, setSelectedMedia] = useState("");
  const [comments, setComments] = useState<IgComment[]>([]);
  const [replyText, setReplyText] = useState("Thanks for reaching out!");
  const [selectedComment, setSelectedComment] = useState("");

  useEffect(() => {
    if (!accountId) return;
    Promise.all([apiWebhookSetup(), apiGetCommentSettings(accountId), apiListCommentEvents(accountId)])
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
    apiListMedia(accountId)
      .then((r) => {
        setMedia(r.media);
        setSelectedMedia((p) => p || r.media[0]?.id || "");
      })
      .catch((e) => onError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  }, [accountId, onError, setBusy]);

  useEffect(() => {
    if (!accountId || !selectedMedia) {
      setComments([]);
      return;
    }
    setBusy("Loading comments…");
    apiListMediaComments(accountId, selectedMedia)
      .then((r) => {
        setComments(r.comments);
        setSelectedComment((p) => p || r.comments[0]?.id || "");
      })
      .catch((e) => onError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  }, [accountId, selectedMedia, onError, setBusy]);

  async function saveAutoReply() {
    setBusy("Saving auto-reply…");
    try {
      const { autoReply: saved } = await apiUpdateCommentSettings(accountId, autoReply);
      setAutoReply(saved);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function refreshEvents() {
    const ev = await apiListCommentEvents(accountId);
    setEvents(ev.events);
  }

  return (
    <div>
      <h3 style={styles.h3}>Post comments</h3>

      {webhook ? (
        <div style={styles.webhookBox}>
          <p style={styles.subtle}>
            <strong>Webhook URL</strong> (Meta → Webhooks → Callback URL):
          </p>
          <code style={styles.code}>{webhook.callbackUrl}</code>
          <p style={styles.subtle}>
            <strong>Verify token:</strong> <code>{webhook.verifyToken}</code>
          </p>
          <p style={styles.subtle}>
            Subscribe fields: <code>{webhook.subscribedFields.join(", ")}</code>
          </p>
          <p style={styles.subtle}>
            Set <code>WEBHOOK_VERIFY_TOKEN</code> and <code>WEBHOOK_PUBLIC_URL</code> in{" "}
            <code>server/.env</code> to match.
          </p>
        </div>
      ) : null}

      <div style={styles.webhookBox}>
        <p style={styles.subtle}>
          <strong>Auto-reply on new comment</strong> (via webhook). Requires{" "}
          <code>instagram_manage_comments</code> + <code>pages_messaging</code>.
        </p>
        <label style={styles.checkRow}>
          <input
            type="checkbox"
            checked={autoReply.publicEnabled}
            onChange={(e) => setAutoReply({ ...autoReply, publicEnabled: e.target.checked })}
          />
          Public reply under post
        </label>
        <input
          style={styles.input}
          value={autoReply.publicMessage}
          onChange={(e) => setAutoReply({ ...autoReply, publicMessage: e.target.value })}
        />
        <label style={styles.checkRow}>
          <input
            type="checkbox"
            checked={autoReply.privateEnabled}
            onChange={(e) => setAutoReply({ ...autoReply, privateEnabled: e.target.checked })}
          />
          Private reply (DM via comment_id)
        </label>
        <input
          style={styles.input}
          value={autoReply.privateMessage}
          onChange={(e) => setAutoReply({ ...autoReply, privateMessage: e.target.value })}
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
          <p style={styles.subtle}>No webhook comments yet. Comment on a post to test.</p>
        ) : (
          events.slice(0, 8).map((ev) => (
            <div key={ev.id} style={styles.pageRow}>
              <div style={{ flex: 1 }}>
                <div style={styles.pageName}>@{ev.username ?? "?"}</div>
                <div style={styles.subtle}>{ev.text}</div>
                <div style={styles.subtle}>
                  {ev.publicReplied ? "✓ public" : ""} {ev.privateReplied ? "✓ private" : ""}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #eee" }} />

      <p style={styles.subtle}>
        <strong>Manual reply</strong> — fetch comments on a post via API:
      </p>
      <select
        style={styles.select}
        value={selectedMedia}
        onChange={(e) => setSelectedMedia(e.target.value)}
      >
        <option value="">Select post…</option>
        {media.map((m) => (
          <option key={m.id} value={m.id}>
            {(m.caption ?? m.id).slice(0, 50)}
          </option>
        ))}
      </select>

      <div style={styles.chatGrid}>
        <div style={styles.threadList}>
          {comments.map((c) => (
            <button
              key={c.id}
              type="button"
              style={{
                ...styles.threadBtn,
                ...(c.id === selectedComment ? styles.threadBtnOn : {}),
              }}
              onClick={() => setSelectedComment(c.id)}
            >
              <div>@{c.username ?? c.from?.username ?? "?"}</div>
              <div style={styles.subtle}>{c.text}</div>
            </button>
          ))}
        </div>
        <div style={styles.messagePane}>
          <textarea
            style={{ ...styles.input, minHeight: 60, width: "100%" }}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              style={styles.smallBtn}
              disabled={!selectedComment || !!busy}
              onClick={() =>
                apiReplyPublic(accountId, selectedComment, replyText)
                  .then(() => onNotice("Public reply sent."))
                  .catch((e) => onError(e.message))
              }
            >
              Public reply
            </button>
            <button
              type="button"
              style={styles.smallBtnSec}
              disabled={!selectedComment || !!busy}
              onClick={() =>
                apiReplyPrivate(accountId, selectedComment, replyText)
                  .then(() => onNotice("Private DM sent."))
                  .catch((e) => onError(e.message))
              }
            >
              Private DM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
