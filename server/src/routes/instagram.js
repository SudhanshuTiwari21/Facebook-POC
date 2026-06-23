import { Router } from "express";
import {
  graphGet,
  graphPost,
  newSessionId,
  getOrigin,
  createSessionMiddleware,
  setSessionCookie,
  clearSessionCookie,
} from "../lib/shared.js";
import {
  registerIgAccount,
  unregisterIgAccount,
  getConnected,
  getCommentEvents,
  defaultAutoReply,
} from "../lib/ig-registry.js";
import { getWebhookSetupInfo } from "./instagram-webhooks.js";

const sessions = new Map();
const requireSession = createSessionMiddleware(sessions, "ig_sid");

export const instagramRouter = Router();

/** @typedef {{ id: string, username?: string, name?: string, pageId: string, pageName: string, pageAccessToken: string }} IgAccount */

instagramRouter.post("/session", async (req, res) => {
  const { userAccessToken } = req.body ?? {};
  if (!userAccessToken || typeof userAccessToken !== "string") {
    return res.status(400).json({ error: "Missing userAccessToken" });
  }

  try {
    const me = await graphGet("me?fields=id,name", userAccessToken);
    const sid = newSessionId();
    sessions.set(sid, {
      createdAt: Date.now(),
      origin: getOrigin(req),
      userAccessToken,
      user: me,
      /** @type {Map<string, IgAccount>} */
      connectedAccounts: new Map(),
    });
    setSessionCookie(res, "ig_sid", sid);
    return res.json({ user: me });
  } catch (e) {
    return res.status(400).json({
      error: e instanceof Error ? e.message : "Invalid token",
      details: e?.details,
    });
  }
});

instagramRouter.post("/logout", requireSession, (req, res) => {
  sessions.delete(req.sid);
  clearSessionCookie(res, "ig_sid");
  return res.json({ ok: true });
});

async function listIgAccountsFromPages(userAccessToken) {
  const json = await graphGet(
    "me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}",
    userAccessToken
  );

  const accounts = [];
  for (const page of json?.data ?? []) {
    const ig = page.instagram_business_account;
    if (!ig?.id) continue;
    accounts.push({
      id: ig.id,
      username: ig.username ?? ig.name ?? ig.id,
      name: ig.name ?? ig.username ?? "Instagram account",
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: page.access_token,
      connected: false,
    });
  }
  return accounts;
}

instagramRouter.get("/accounts", requireSession, async (req, res) => {
  try {
    const accounts = await listIgAccountsFromPages(req.session.userAccessToken);
    const connected = req.session.connectedAccounts;
    return res.json({
      accounts: accounts.map((a) => ({
        ...a,
        connected: connected.has(a.id),
      })),
    });
  } catch (e) {
    return res.status(400).json({
      error: e instanceof Error ? e.message : "Failed",
      details: e?.details,
    });
  }
});

instagramRouter.get("/accounts/connected", requireSession, (req, res) => {
  const accounts = Array.from(req.session.connectedAccounts.values()).map((a) => ({
    id: a.id,
    username: a.username,
    name: a.name,
  }));
  return res.json({ accounts });
});

instagramRouter.post("/accounts/:accountId/connect", requireSession, async (req, res) => {
  const { accountId } = req.params;
  try {
    const accounts = await listIgAccountsFromPages(req.session.userAccessToken);
    const found = accounts.find((a) => a.id === accountId);
    if (!found) {
      return res.status(404).json({
        error: "Instagram account not found. Link IG to a Facebook Page you manage.",
      });
    }

    req.session.connectedAccounts.set(accountId, {
      id: found.id,
      username: found.username,
      name: found.name,
      pageId: found.pageId,
      pageName: found.pageName,
      pageAccessToken: found.pageAccessToken,
    });
    registerIgAccount({
      igId: found.id,
      igUsername: found.username,
      pageId: found.pageId,
      pageName: found.pageName,
      pageAccessToken: found.pageAccessToken,
      autoReply: defaultAutoReply(),
    });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({
      error: e instanceof Error ? e.message : "Failed",
      details: e?.details,
    });
  }
});

instagramRouter.delete("/accounts/:accountId/disconnect", requireSession, (req, res) => {
  unregisterIgAccount(req.params.accountId);
  req.session.connectedAccounts.delete(req.params.accountId);
  return res.json({ ok: true });
});

instagramRouter.get("/webhooks/setup", requireSession, (req, res) => {
  return res.json(getWebhookSetupInfo(req));
});

instagramRouter.get(
  "/accounts/:accountId/comment-settings",
  requireSession,
  requireConnectedAccount,
  (req, res) => {
    const conn = getConnected(req.params.accountId);
    return res.json({ autoReply: conn?.autoReply ?? defaultAutoReply() });
  }
);

instagramRouter.put(
  "/accounts/:accountId/comment-settings",
  requireSession,
  requireConnectedAccount,
  (req, res) => {
    const conn = getConnected(req.params.accountId);
    if (!conn) return res.status(404).json({ error: "Not registered for webhooks" });
    const { publicEnabled, publicMessage, privateEnabled, privateMessage } = req.body ?? {};
    conn.autoReply = {
      publicEnabled: Boolean(publicEnabled),
      publicMessage: String(publicMessage ?? conn.autoReply.publicMessage),
      privateEnabled: Boolean(privateEnabled),
      privateMessage: String(privateMessage ?? conn.autoReply.privateMessage),
    };
    registerIgAccount(conn);
    return res.json({ autoReply: conn.autoReply });
  }
);

instagramRouter.get(
  "/accounts/:accountId/comment-events",
  requireSession,
  requireConnectedAccount,
  (req, res) => {
    return res.json({ events: getCommentEvents(req.params.accountId) });
  }
);

instagramRouter.get(
  "/accounts/:accountId/media",
  requireSession,
  requireConnectedAccount,
  async (req, res) => {
    try {
      const json = await graphGet(
        `${req.igAccount.id}/media?fields=id,caption,media_type,timestamp,permalink`,
        req.igAccount.pageAccessToken
      );
      return res.json({ media: json?.data ?? [] });
    } catch (e) {
      return res.status(400).json({
        error: e instanceof Error ? e.message : "Failed",
        details: e?.details,
      });
    }
  }
);

instagramRouter.get(
  "/accounts/:accountId/media/:mediaId/comments",
  requireSession,
  requireConnectedAccount,
  async (req, res) => {
    try {
      const json = await graphGet(
        `${req.params.mediaId}/comments?fields=id,text,timestamp,username,from`,
        req.igAccount.pageAccessToken
      );
      return res.json({ comments: json?.data ?? [] });
    } catch (e) {
      return res.status(400).json({
        error: e instanceof Error ? e.message : "Failed",
        details: e?.details,
      });
    }
  }
);

instagramRouter.post(
  "/accounts/:accountId/comments/:commentId/reply-public",
  requireSession,
  requireConnectedAccount,
  async (req, res) => {
    const { message } = req.body ?? {};
    if (!message) return res.status(400).json({ error: "Missing message" });
    try {
      const result = await graphPost(
        `${req.params.commentId}/replies`,
        req.igAccount.pageAccessToken,
        { message }
      );
      return res.json({ ok: true, result });
    } catch (e) {
      return res.status(400).json({
        error: e instanceof Error ? e.message : "Failed",
        details: e?.details,
      });
    }
  }
);

instagramRouter.post(
  "/accounts/:accountId/comments/:commentId/reply-private",
  requireSession,
  requireConnectedAccount,
  async (req, res) => {
    const { message } = req.body ?? {};
    if (!message) return res.status(400).json({ error: "Missing message" });
    try {
      const result = await graphPost(
        `${req.igAccount.pageId}/messages`,
        req.igAccount.pageAccessToken,
        {
          recipient: { comment_id: req.params.commentId },
          message: { text: message },
        }
      );
      return res.json({ ok: true, result });
    } catch (e) {
      return res.status(400).json({
        error: e instanceof Error ? e.message : "Failed",
        details: e?.details,
      });
    }
  }
);

function requireConnectedAccount(req, res, next) {
  const account = req.session.connectedAccounts.get(req.params.accountId);
  if (!account) return res.status(404).json({ error: "Instagram account not connected" });
  req.igAccount = account;
  return next();
}

instagramRouter.get(
  "/accounts/:accountId/conversations",
  requireSession,
  requireConnectedAccount,
  async (req, res) => {
    try {
      const json = await graphGet(
        `${req.igAccount.pageId}/conversations?fields=participants,updated_time,snippet,link&platform=instagram`,
        req.igAccount.pageAccessToken
      );
      return res.json({ conversations: json?.data ?? [] });
    } catch (e) {
      return res.status(400).json({
        error: e instanceof Error ? e.message : "Failed",
        details: e?.details,
      });
    }
  }
);

instagramRouter.get(
  "/accounts/:accountId/conversations/:conversationId/messages",
  requireSession,
  requireConnectedAccount,
  async (req, res) => {
    try {
      const json = await graphGet(
        `${req.params.conversationId}/messages?fields=from,to,message,created_time`,
        req.igAccount.pageAccessToken
      );
      return res.json({ messages: json?.data ?? [] });
    } catch (e) {
      return res.status(400).json({
        error: e instanceof Error ? e.message : "Failed",
        details: e?.details,
      });
    }
  }
);
