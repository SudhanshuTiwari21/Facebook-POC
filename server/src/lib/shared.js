import crypto from "node:crypto";

export const GRAPH_VERSION = process.env.GRAPH_VERSION ?? "v20.0";
export const THREADS_GRAPH_VERSION = process.env.THREADS_GRAPH_VERSION ?? "v1.0";

export function newSessionId() {
  return crypto.randomBytes(18).toString("base64url");
}

export function getOrigin(req) {
  return req.headers.origin || "";
}

export function allowOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    if (url.hostname.endsWith(".ngrok-free.app")) return true;
    return false;
  } catch {
    return false;
  }
}

export async function graphPost(path, accessToken, body = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json?.error) {
    const message = json?.error?.message ?? `Graph API POST failed: ${res.status}`;
    const err = new Error(message);
    err.details = json?.error ?? json;
    throw err;
  }
  return json;
}

export function verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret || !signatureHeader) return true; // dev skip if no secret
  const expected = signatureHeader.replace(/^sha256=/, "");
  const hmac = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(hmac, "hex"));
  } catch {
    return false;
  }
}

export async function graphGet(path, accessToken, base = "https://graph.facebook.com") {
  const url = new URL(`${base}/${GRAPH_VERSION}/${path}`);
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok || json?.error) {
    const message = json?.error?.message ?? `Graph API request failed: ${res.status}`;
    const err = new Error(message);
    err.details = json?.error ?? json;
    throw err;
  }
  return json;
}

export async function threadsGet(path, accessToken) {
  const url = new URL(`https://graph.threads.net/${THREADS_GRAPH_VERSION}/${path}`);
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok || json?.error) {
    const message = json?.error?.message ?? `Threads API request failed: ${res.status}`;
    const err = new Error(message);
    err.details = json?.error ?? json;
    throw err;
  }
  return json;
}

export async function threadsPost(path, accessToken, params = {}) {
  const url = new URL(`https://graph.threads.net/${THREADS_GRAPH_VERSION}/${path}`);
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) body.set(key, String(value));
  }
  body.set("access_token", accessToken);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok || json?.error) {
    const message = json?.error?.message ?? `Threads API POST failed: ${res.status}`;
    const err = new Error(message);
    err.details = json?.error ?? json;
    throw err;
  }
  return json;
}

export async function publishThreadsReply(threadsUserId, accessToken, replyToId, text) {
  const container = await threadsPost(`${threadsUserId}/threads`, accessToken, {
    media_type: "TEXT",
    text,
    reply_to_id: replyToId,
  });
  return threadsPost(`${threadsUserId}/threads_publish`, accessToken, {
    creation_id: container.id,
  });
}

export function createSessionMiddleware(sessions, cookieName) {
  return function requireSession(req, res, next) {
    const sid = req.cookies?.[cookieName];
    if (!sid || !sessions.has(sid)) {
      return res.status(401).json({ error: "Not logged in (no session)" });
    }
    req.session = sessions.get(sid);
    req.sid = sid;
    req.sessionCookieName = cookieName;
    return next();
  };
}

export function setSessionCookie(res, cookieName, sid) {
  res.cookie(cookieName, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res, cookieName) {
  res.clearCookie(cookieName, { path: "/" });
}
