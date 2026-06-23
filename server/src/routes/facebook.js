import { Router } from "express";
import {
  graphGet,
  newSessionId,
  getOrigin,
  createSessionMiddleware,
  setSessionCookie,
  clearSessionCookie,
} from "../lib/shared.js";

const sessions = new Map();
const requireSession = createSessionMiddleware(sessions, "sid");

export const facebookRouter = Router();

facebookRouter.post("/session", async (req, res) => {
  const { userAccessToken } = req.body ?? {};
  if (!userAccessToken || typeof userAccessToken !== "string") {
    return res.status(400).json({ error: "Missing userAccessToken" });
  }

  try {
    const me = await graphGet("me?fields=id,name,email", userAccessToken);
    const sid = newSessionId();
    sessions.set(sid, {
      createdAt: Date.now(),
      origin: getOrigin(req),
      userAccessToken,
      user: me,
      connectedPages: new Map(),
    });
    setSessionCookie(res, "sid", sid);
    return res.json({ user: me });
  } catch (e) {
    return res.status(400).json({
      error: e instanceof Error ? e.message : "Invalid token",
      details: e?.details,
    });
  }
});

facebookRouter.post("/logout", requireSession, (req, res) => {
  sessions.delete(req.sid);
  clearSessionCookie(res, "sid");
  return res.json({ ok: true });
});

facebookRouter.get("/pages", requireSession, async (req, res) => {
  try {
    const json = await graphGet(
      "me/accounts?fields=id,name,access_token",
      req.session.userAccessToken
    );
    const connected = req.session.connectedPages;
    const pages = (json?.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      connected: connected.has(p.id),
    }));
    return res.json({ pages });
  } catch (e) {
    return res.status(400).json({
      error: e instanceof Error ? e.message : "Failed",
      details: e?.details,
    });
  }
});

facebookRouter.get("/pages/connected", requireSession, (req, res) => {
  const pages = Array.from(req.session.connectedPages.values()).map((p) => ({
    id: p.id,
    name: p.name,
  }));
  return res.json({ pages });
});

facebookRouter.post("/pages/:pageId/connect", requireSession, async (req, res) => {
  const { pageId } = req.params;
  try {
    const json = await graphGet(
      "me/accounts?fields=id,name,access_token",
      req.session.userAccessToken
    );
    const found = (json?.data ?? []).find((p) => p.id === pageId);
    if (!found) return res.status(404).json({ error: "Page not found for this user" });

    req.session.connectedPages.set(pageId, {
      id: found.id,
      name: found.name,
      access_token: found.access_token,
    });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({
      error: e instanceof Error ? e.message : "Failed",
      details: e?.details,
    });
  }
});

facebookRouter.delete("/pages/:pageId/disconnect", requireSession, (req, res) => {
  req.session.connectedPages.delete(req.params.pageId);
  return res.json({ ok: true });
});

function requireConnectedPage(req, res, next) {
  const page = req.session.connectedPages.get(req.params.pageId);
  if (!page) return res.status(404).json({ error: "Page not connected" });
  req.page = page;
  return next();
}

facebookRouter.get(
  "/pages/:pageId/conversations",
  requireSession,
  requireConnectedPage,
  async (req, res) => {
    try {
      const json = await graphGet(
        `${req.params.pageId}/conversations?fields=participants,updated_time,snippet,link&platform=messenger`,
        req.page.access_token
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

facebookRouter.get(
  "/pages/:pageId/conversations/:conversationId/messages",
  requireSession,
  requireConnectedPage,
  async (req, res) => {
    try {
      const json = await graphGet(
        `${req.params.conversationId}/messages?fields=from,to,message,created_time`,
        req.page.access_token
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
