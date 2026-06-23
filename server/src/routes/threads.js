import { Router } from "express";
import {
  graphGet,
  threadsGet,
  threadsPost,
  publishThreadsReply,
  newSessionId,
  getOrigin,
  createSessionMiddleware,
  setSessionCookie,
  clearSessionCookie,
} from "../lib/shared.js";
import {
  registerThreadsProfile,
  unregisterThreadsProfile,
  getConnectedThreads,
  getReplyEvents,
  defaultAutoReply,
} from "../lib/th-registry.js";
import { getThreadsWebhookSetupInfo } from "./threads-webhooks.js";

const sessions = new Map();
const requireSession = createSessionMiddleware(sessions, "th_sid");

export const threadsRouter = Router();

/** @typedef {{ id: string, username?: string, name?: string }} ThreadsAccount */

threadsRouter.post("/session", async (req, res) => {
  const { userAccessToken } = req.body ?? {};
  if (!userAccessToken || typeof userAccessToken !== "string") {
    return res.status(400).json({ error: "Missing userAccessToken" });
  }

  try {
    const me = await graphGet("me?fields=id,name", userAccessToken);
    let threadsProfile = null;
    try {
      threadsProfile = await threadsGet(
        "me?fields=id,username,threads_profile_picture_url",
        userAccessToken
      );
    } catch {
      // Threads profile requires threads_basic on the token.
    }

    const sid = newSessionId();
    sessions.set(sid, {
      createdAt: Date.now(),
      origin: getOrigin(req),
      userAccessToken,
      user: me,
      threadsProfile,
      /** @type {ThreadsAccount | null} */
      connectedProfile: null,
    });
    setSessionCookie(res, "th_sid", sid);
    return res.json({ user: me, threadsProfile });
  } catch (e) {
    return res.status(400).json({
      error: e instanceof Error ? e.message : "Invalid token",
      details: e?.details,
    });
  }
});

threadsRouter.post("/logout", requireSession, (req, res) => {
  sessions.delete(req.sid);
  clearSessionCookie(res, "th_sid");
  return res.json({ ok: true });
});

async function fetchThreadsProfile(userAccessToken) {
  return threadsGet("me?fields=id,username,threads_profile_picture_url", userAccessToken);
}

threadsRouter.get("/accounts", requireSession, async (req, res) => {
  try {
    const profile = await fetchThreadsProfile(req.session.userAccessToken);
    const connected = req.session.connectedProfile;
    return res.json({
      accounts: [
        {
          id: profile.id,
          username: profile.username,
          name: profile.username ?? profile.id,
          connected: connected?.id === profile.id,
        },
      ],
    });
  } catch (e) {
    return res.status(400).json({
      error: e instanceof Error ? e.message : "Failed to load Threads profile",
      details: e?.details,
    });
  }
});

threadsRouter.get("/accounts/connected", requireSession, (req, res) => {
  const p = req.session.connectedProfile;
  return res.json({
    accounts: p ? [{ id: p.id, username: p.username, name: p.username ?? p.name }] : [],
  });
});

threadsRouter.post("/accounts/:accountId/connect", requireSession, async (req, res) => {
  const { accountId } = req.params;
  try {
    const profile = await fetchThreadsProfile(req.session.userAccessToken);
    if (profile.id !== accountId) {
      return res.status(404).json({ error: "Threads profile not found for this account" });
    }

    req.session.connectedProfile = {
      id: profile.id,
      username: profile.username ?? profile.id,
      name: profile.username ?? profile.id,
    };
    registerThreadsProfile({
      threadsUserId: profile.id,
      username: profile.username,
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

threadsRouter.delete("/accounts/:accountId/disconnect", requireSession, (req, res) => {
  unregisterThreadsProfile(req.params.accountId);
  req.session.connectedProfile = null;
  return res.json({ ok: true });
});

threadsRouter.get("/webhooks/setup", requireSession, (req, res) => {
  return res.json(getThreadsWebhookSetupInfo(req));
});

threadsRouter.get(
  "/accounts/:accountId/reply-settings",
  requireSession,
  requireConnectedProfile,
  (req, res) => {
    const conn = getConnectedThreads(req.params.accountId);
    return res.json({ autoReply: conn?.autoReply ?? defaultAutoReply() });
  }
);

threadsRouter.put(
  "/accounts/:accountId/reply-settings",
  requireSession,
  requireConnectedProfile,
  (req, res) => {
    const conn = getConnectedThreads(req.params.accountId);
    if (!conn) return res.status(404).json({ error: "Not registered for webhooks" });
    const { enabled, message } = req.body ?? {};
    conn.autoReply = {
      enabled: Boolean(enabled),
      message: String(message ?? conn.autoReply.message),
    };
    registerThreadsProfile(conn);
    return res.json({ autoReply: conn.autoReply });
  }
);

threadsRouter.get(
  "/accounts/:accountId/reply-events",
  requireSession,
  requireConnectedProfile,
  (req, res) => {
    return res.json({ events: getReplyEvents(req.params.accountId) });
  }
);

function requireConnectedProfile(req, res, next) {
  const account = req.session.connectedProfile;
  if (!account || account.id !== req.params.accountId) {
    return res.status(404).json({ error: "Threads profile not connected" });
  }
  req.threadsUser = account;
  return next();
}

threadsRouter.get("/profile", requireSession, async (req, res) => {
  try {
    const profile = await fetchThreadsProfile(req.session.userAccessToken);
    return res.json({ profile });
  } catch (e) {
    return res.status(400).json({
      error: e instanceof Error ? e.message : "Failed",
      details: e?.details,
    });
  }
});

threadsRouter.get(
  "/accounts/:accountId/threads",
  requireSession,
  requireConnectedProfile,
  async (req, res) => {
    try {
      const json = await threadsGet(
        `${req.threadsUser.id}/threads?fields=id,text,timestamp,permalink`,
        req.session.userAccessToken
      );
      return res.json({ threads: json?.data ?? [] });
    } catch (e) {
      return res.status(400).json({
        error: e instanceof Error ? e.message : "Failed",
        details: e?.details,
      });
    }
  }
);

threadsRouter.get(
  "/accounts/:accountId/threads/:threadId/replies",
  requireSession,
  requireConnectedProfile,
  async (req, res) => {
    try {
      const json = await threadsGet(
        `${req.params.threadId}/replies?fields=id,text,timestamp,username`,
        req.session.userAccessToken
      );
      return res.json({ replies: json?.data ?? [] });
    } catch (e) {
      return res.status(400).json({
        error: e instanceof Error ? e.message : "Failed",
        details: e?.details,
      });
    }
  }
);

threadsRouter.post(
  "/accounts/:accountId/threads/:threadId/reply",
  requireSession,
  requireConnectedProfile,
  async (req, res) => {
    const { message } = req.body ?? {};
    if (!message) return res.status(400).json({ error: "Missing message" });
    try {
      const result = await publishThreadsReply(
        req.threadsUser.id,
        req.session.userAccessToken,
        req.params.threadId,
        message
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

threadsRouter.post(
  "/accounts/:accountId/replies/:replyId/hide",
  requireSession,
  requireConnectedProfile,
  async (req, res) => {
    const hide = req.body?.hide !== false;
    try {
      const result = await threadsPost(
        `${req.params.replyId}/manage_reply`,
        req.session.userAccessToken,
        { hide }
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
