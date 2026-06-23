import { Router } from "express";
import express from "express";
import { publishThreadsReply, verifyMetaWebhookSignature } from "../lib/shared.js";
import {
  connectedByThreadsId,
  getConnectedThreads,
  pushReplyEvent,
} from "../lib/th-registry.js";

export const threadsWebhookRouter = Router();

threadsWebhookRouter.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN ?? "meta_poc_verify_token";
const APP_SECRET = process.env.FB_APP_SECRET ?? "";

threadsWebhookRouter.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[webhook] Threads verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

async function handleReplyValue(threadsUserId, value, accessTokenFromPayload) {
  const replyId = value?.id ?? value?.reply_id;
  if (!replyId) return;

  const event = {
    id: `${Date.now()}-${replyId}`,
    replyId,
    text: value?.text,
    username: value?.username ?? value?.from?.username,
    threadId: value?.root_post?.id ?? value?.media_id ?? value?.thread_id,
    receivedAt: Date.now(),
  };
  pushReplyEvent(threadsUserId, event);

  const conn = getConnectedThreads(threadsUserId);
  if (!conn?.autoReply.enabled || !conn.autoReply.message) return;

  const token = accessTokenFromPayload;
  if (!token) {
    console.log("[webhook] Threads auto-reply skipped (no token in payload)");
    return;
  }

  try {
    const threadId = event.threadId ?? replyId;
    await publishThreadsReply(threadsUserId, token, threadId, conn.autoReply.message);
    event.autoReplied = true;
    console.log("[webhook] Threads auto-reply sent", replyId);
  } catch (e) {
    console.error("[webhook] Threads auto-reply failed", e.message);
  }
}

threadsWebhookRouter.post("/", async (req, res) => {
  const signature = req.headers["x-hub-signature-256"];
  if (
    APP_SECRET &&
    !verifyMetaWebhookSignature(req.rawBody ?? Buffer.from(""), signature, APP_SECRET)
  ) {
    return res.sendStatus(403);
  }

  res.sendStatus(200);

  const body = req.body;
  if (body?.object !== "threads" && body?.object !== "threads_user") return;

  for (const entry of body.entry ?? []) {
    const threadsUserId = entry.id;
    for (const change of entry.changes ?? []) {
      if (
        change.field === "replies" ||
        change.field === "mentions" ||
        change.field === "reply"
      ) {
        await handleReplyValue(threadsUserId, change.value, entry.access_token);
      }
    }
  }
});

export function getThreadsWebhookSetupInfo(req) {
  const envUrl = process.env.WEBHOOK_PUBLIC_URL?.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8787";
  const base = envUrl ?? `${proto}://${host}`;
  return {
    callbackUrl: `${base}/api/threads/webhooks`,
    verifyToken: VERIFY_TOKEN,
    subscribedFields: ["replies", "mentions"],
    connectedProfiles: Array.from(connectedByThreadsId.values()).map((c) => ({
      threadsUserId: c.threadsUserId,
      username: c.username,
    })),
  };
}
