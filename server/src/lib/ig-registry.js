/** @typedef {{ pageId: string, pageName: string, pageAccessToken: string, igId: string, igUsername?: string, autoReply: AutoReplySettings }} ConnectedIgPage */

/** @typedef {{ publicEnabled: boolean, publicMessage: string, privateEnabled: boolean, privateMessage: string }} AutoReplySettings */

/** @type {Map<string, ConnectedIgPage>} igId -> connection */
export const connectedByIgId = new Map();

/** @type {Map<string, CommentEvent[]>} igId -> events */
export const commentEventsByIgId = new Map();

const MAX_EVENTS = 100;

/** @typedef {{ id: string, commentId: string, text?: string, username?: string, mediaId?: string, receivedAt: number, publicReplied?: boolean, privateReplied?: boolean }} CommentEvent */

export function registerIgAccount(account) {
  connectedByIgId.set(account.igId, {
    pageId: account.pageId,
    pageName: account.pageName,
    pageAccessToken: account.pageAccessToken,
    igId: account.igId,
    igUsername: account.igUsername,
    autoReply: account.autoReply ?? defaultAutoReply(),
  });
}

export function unregisterIgAccount(igId) {
  connectedByIgId.delete(igId);
}

export function getConnected(igId) {
  return connectedByIgId.get(igId);
}

export function defaultAutoReply() {
  return {
    publicEnabled: false,
    publicMessage: "Thanks for your comment! 🙏",
    privateEnabled: false,
    privateMessage: "Thanks for commenting! We sent you a private message.",
  };
}

export function pushCommentEvent(igId, event) {
  const list = commentEventsByIgId.get(igId) ?? [];
  list.unshift(event);
  if (list.length > MAX_EVENTS) list.length = MAX_EVENTS;
  commentEventsByIgId.set(igId, list);
}

export function getCommentEvents(igId) {
  return commentEventsByIgId.get(igId) ?? [];
}
