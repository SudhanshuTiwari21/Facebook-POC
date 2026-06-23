import { Router } from "express";
import express from "express";
import {
  graphPost,
  verifyMetaWebhookSignature,
} from "../lib/shared.js";
import {
  connectedByIgId,
  getConnected,
  pushCommentEvent,
} from "../lib/ig-registry.js";

export const instagramWebhookRouter = Router();

instagramWebhookRouter.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN ?? "meta_poc_verify_token";
const APP_SECRET = process.env.FB_APP_SECRET ?? "";

/** Meta webhook verification (GET). */
instagramWebhookRouter.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[webhook] Instagram verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

async function sendPublicReply(pageAccessToken, commentId, message) {
  return graphPost(`${commentId}/replies`, pageAccessToken, { message });
}

async function sendPrivateReply(pageId, pageAccessToken, commentId, message) {
  return graphPost(`${pageId}/messages`, pageAccessToken, {
    recipient: { comment_id: commentId },
    message: { text: message },
  });
}

async function handleCommentValue(igAccountId, value) {
  const conn = getConnected(igAccountId);
  const commentId = value?.id;
  if (!commentId) return;

  const event = {
    id: `${Date.now()}-${commentId}`,
    commentId,
    text: value?.text,
    username: value?.from?.username ?? value?.from?.id,
    mediaId: value?.media?.id,
    receivedAt: Date.now(),
  };
  pushCommentEvent(igAccountId, event);

  if (!conn) {
    console.log("[webhook] comment for unconnected IG account", igAccountId);
    return;
  }

  const { autoReply, pageAccessToken, pageId } = conn;

  if (autoReply.publicEnabled && autoReply.publicMessage) {
    try {
      await sendPublicReply(pageAccessToken, commentId, autoReply.publicMessage);
      event.publicReplied = true;
      console.log("[webhook] public reply sent", commentId);
    } catch (e) {
      console.error("[webhook] public reply failed", e.message);
    }
  }

  if (autoReply.privateEnabled && autoReply.privateMessage) {
    try {
      await sendPrivateReply(pageId, pageAccessToken, commentId, autoReply.privateMessage);
      event.privateReplied = true;
      console.log("[webhook] private reply sent", commentId);
    } catch (e) {
      console.error("[webhook] private reply failed", e.message);
    }
  }
}

/** Meta webhook notifications (POST). */
instagramWebhookRouter.post("/", async (req, res) => {
  const signature = req.headers["x-hub-signature-256"];
  if (
    APP_SECRET &&
    !verifyMetaWebhookSignature(req.rawBody ?? Buffer.from(""), signature, APP_SECRET)
  ) {
    return res.sendStatus(403);
  }

  res.sendStatus(200);

  const body = req.body;
  if (body?.object !== "instagram") return;

  for (const entry of body.entry ?? []) {
    const igAccountId = entry.id;
    for (const change of entry.changes ?? []) {
      if (change.field === "comments" || change.field === "live_comments") {
        await handleCommentValue(igAccountId, change.value);
      }
    }
  }
});

export function getWebhookSetupInfo(req) {
  const envUrl = process.env.WEBHOOK_PUBLIC_URL?.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8787";
  const base = envUrl ?? `${proto}://${host}`;
  return {
    callbackUrl: `${base}/api/instagram/webhooks`,
    verifyToken: VERIFY_TOKEN,
    subscribedFields: ["comments", "live_comments", "messages"],
    connectedAccounts: Array.from(connectedByIgId.values()).map((c) => ({
      igId: c.igId,
      username: c.igUsername,
      pageId: c.pageId,
    })),
  };
}
