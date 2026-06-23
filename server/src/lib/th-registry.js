/** @typedef {{ threadsUserId: string, username?: string, autoReply: AutoReplySettings }} ConnectedThreadsProfile */

/** @typedef {{ enabled: boolean, message: string }} AutoReplySettings */

/** @typedef {{ id: string, replyId: string, text?: string, username?: string, threadId?: string, receivedAt: number, autoReplied?: boolean }} ReplyEvent */

/** @type {Map<string, ConnectedThreadsProfile>} threadsUserId -> connection */
export const connectedByThreadsId = new Map();

/** @type {Map<string, ReplyEvent[]>} threadsUserId -> events */
export const replyEventsByThreadsId = new Map();

const MAX_EVENTS = 100;

export function registerThreadsProfile(profile) {
  connectedByThreadsId.set(profile.threadsUserId, {
    threadsUserId: profile.threadsUserId,
    username: profile.username,
    autoReply: profile.autoReply ?? defaultAutoReply(),
  });
}

export function unregisterThreadsProfile(threadsUserId) {
  connectedByThreadsId.delete(threadsUserId);
}

export function getConnectedThreads(threadsUserId) {
  return connectedByThreadsId.get(threadsUserId);
}

export function defaultAutoReply() {
  return {
    enabled: false,
    message: "Thanks for your reply! 🙏",
  };
}

export function pushReplyEvent(threadsUserId, event) {
  const list = replyEventsByThreadsId.get(threadsUserId) ?? [];
  list.unshift(event);
  if (list.length > MAX_EVENTS) list.length = MAX_EVENTS;
  replyEventsByThreadsId.set(threadsUserId, list);
}

export function getReplyEvents(threadsUserId) {
  return replyEventsByThreadsId.get(threadsUserId) ?? [];
}
