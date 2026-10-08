/**
 * TESSA PRIME BOT
 * Unified Spam Protection + Spam Kick
 * Author: Rakib
 */

module.exports.config = {
  name: "spamkick",
  version: "4.0.0",
  author: "Rakib",
  role: {
    onStart: 1,
    onChat: 0,
    onReaction: 1
  },
  usePrefix: true,
  description: {
    en: "Unified spam protection and auto kick system"
  },
  category: "group",
  guide: {
    en:
      "spamkick on\n" +
      "spamkick off\n" +
      "spamkick status"
  },
  countDown: 5
};


// ============================================================
// GLOBAL STORAGE
// ============================================================

if (!global.antispam) {
  global.antispam = new Map();
}


// ============================================================
// DEFAULT CONFIG
// ============================================================

const CONFIG = {
  // User protection
  FAST_WINDOW: 10 * 1000,
  FAST_LIMIT: 8,

  // Kick protection
  KICK_WINDOW: 80 * 1000,
  KICK_LIMIT: 15,

  // Group protection
  GROUP_WINDOW: 5 * 60 * 1000,
  GROUP_LIMIT: 500,

  // Old data cleanup
  CLEANUP_AFTER: 10 * 60 * 1000
};


// ============================================================
// THREAD DATA
// ============================================================

function getThreadData(threadID) {
  threadID = String(threadID);

  if (!global.antispam.has(threadID)) {
    global.antispam.set(threadID, {
      enabled: true,

      users: {},

      groupMessages: [],

      groupAction: false,

      createdAt: Date.now()
    });
  }

  return global.antispam.get(threadID);
}


// ============================================================
// ID NORMALIZER
// ============================================================

function normalizeID(id) {
  return String(id || "");
}


// ============================================================
// BOT ADMIN / OWNER CHECK
// ============================================================

function isBotAdmin(senderID) {
  try {
    const config = global.GoatBot?.config || {};

    const adminBot = (config.adminBot || []).map(normalizeID);
    const ownerBot = (config.ownerBot || []).map(normalizeID);

    const id = normalizeID(senderID);

    return (
      adminBot.includes(id) ||
      ownerBot.includes(id)
    );
  }
  catch {
    return false;
  }
}


// ============================================================
// CLEAN USER DATA
// ============================================================

function cleanupUser(user) {
  const now = Date.now();

  if (!user)
    return null;

  user.fast = (user.fast || []).filter(
    t => now - t < CONFIG.FAST_WINDOW
  );

  user.kick = (user.kick || []).filter(
    t => now - t < CONFIG.KICK_WINDOW
  );

  return user;
}


// ============================================================
// CLEAN THREAD
// ============================================================

function cleanupThread(threadInfo) {
  const now = Date.now();

  threadInfo.groupMessages =
    (threadInfo.groupMessages || []).filter(
      t => now - t < CONFIG.GROUP_WINDOW
    );

  for (const uid of Object.keys(threadInfo.users || {})) {
    const user = cleanupUser(threadInfo.users[uid]);

    if (!user)
      continue;

    const lastActivity =
      user.lastActivity || user.firstKickTime || now;

    if (
      user.fast.length === 0 &&
      user.kick.length === 0 &&
      now - lastActivity > CONFIG.CLEANUP_AFTER
    ) {
      delete threadInfo.users[uid];
    }
  }
}


// ============================================================
// SAFE SEND
// ============================================================

async function sendMessage(api, body, threadID) {
  try {
    return await api.sendMessage(body, threadID);
  }
  catch (err) {
    console.error(
      "❌ SpamKick sendMessage error:",
      err?.message || err
    );

    return null;
  }
}


// ============================================================
// KICK USER
// ============================================================

async function kickUser({
  api,
  usersData,
  threadID,
  senderID,
  threadInfo,
  commandName
}) {
  const uid = normalizeID(senderID);

  const user = threadInfo.users[uid];

  if (!user)
    return false;

  if (user.kicking)
    return false;

  user.kicking = true;

  try {
    console.log(
      `🚨 SpamKick attempting to remove ${uid} from ${threadID}`
    );

    await new Promise((resolve, reject) => {
      api.removeUserFromGroup(
        uid,
        threadID,
        err => {
          if (err)
            return reject(err);

          resolve();
        }
      );
    });

    let name = "User";

    try {
      if (usersData?.getName) {
        name = await usersData.getName(uid);
      }
    }
    catch {}

    const info = await sendMessage(
      api,
      [
        `🚫 ${name} has been removed for spamming.`,
        ``,
        `UID: ${uid}`,
        `📌 Spam limit: ${CONFIG.KICK_LIMIT} messages / ${CONFIG.KICK_WINDOW / 1000}s`,
        ``,
        `👉 React to this message to add the user again.`
      ].join("\n"),
      threadID
    );

    if (
      info?.messageID &&
      global.GoatBot?.onReaction
    ) {
      global.GoatBot.onReaction.set(
        info.messageID,
        {
          commandName,
          uid,
          messageID: info.messageID,
          threadID
        }
      );
    }

    console.log(
      `🚫 SpamKick SUCCESS: ${uid} removed from ${threadID}`
    );

    // IMPORTANT:
    // Reset ONLY after successful kick.
    threadInfo.users[uid] = {
      fast: [],
      kick: [],
      kicking: false,
      lastActivity: Date.now()
    };

    return true;
  }
  catch (err) {
    console.error(
      `❌ SpamKick FAILED for ${uid} in ${threadID}:`,
      err?.message || err
    );

    /*
     * IMPORTANT:
     * Do NOT reset the spam counter when kick fails.
     *
     * This means the next message can retry the kick
     * instead of making the spammer start from zero.
     */

    user.kicking = false;

    return false;
  }
}


// ============================================================
// ON CHAT
// ============================================================

module.exports.onChat = async ({
  api,
  event,
  usersData,
  commandName
}) => {
  const senderID = normalizeID(event?.senderID);
  const threadID = normalizeID(event?.threadID);

  if (!senderID || !threadID)
    return;

  const threadInfo = getThreadData(threadID);

  if (threadInfo.enabled !== true)
    return;


  // ----------------------------------------------------------
  // BOT OWNER / ADMIN SHOULD NOT BE AUTO-KICKED
  // ----------------------------------------------------------

  if (isBotAdmin(senderID))
    return;


  const now = Date.now();

  cleanupThread(threadInfo);


  // ----------------------------------------------------------
  // USER DATA
  // ----------------------------------------------------------

  if (!threadInfo.users[senderID]) {
    threadInfo.users[senderID] = {
      fast: [],
      kick: [],
      kicking: false,
      lastActivity: now
    };
  }

  const user = cleanupUser(
    threadInfo.users[senderID]
  );

  user.lastActivity = now;


  // ----------------------------------------------------------
  // FAST SPAM
  // 8+ messages within 10 seconds
  // ----------------------------------------------------------

  user.fast.push(now);


  // ----------------------------------------------------------
  // KICK SPAM
  // 15+ messages within 80 seconds
  // ----------------------------------------------------------

  user.kick.push(now);


  // ----------------------------------------------------------
  // GROUP SPAM
  // 500+ messages within 5 minutes
  // ----------------------------------------------------------

  threadInfo.groupMessages.push(now);


  // ----------------------------------------------------------
  // FAST SPAM ACTION
  // ----------------------------------------------------------

  if (user.fast.length >= CONFIG.FAST_LIMIT) {

    if (!user.fastWarned) {

      user.fastWarned = true;

      await sendMessage(
        api,
        "🛡️ Auto spam detected.\nPlease stop spamming.",
        threadID
      );
    }
  }
  else {
    user.fastWarned = false;
  }


  // ----------------------------------------------------------
  // AUTO KICK
  // ----------------------------------------------------------

  if (
    user.kick.length >= CONFIG.KICK_LIMIT &&
    !user.kicking
  ) {

    await kickUser({
      api,
      usersData,
      threadID,
      senderID,
      threadInfo,
      commandName
    });

    return;
  }


  // ----------------------------------------------------------
  // GROUP SPAM
  // ----------------------------------------------------------

  if (
    threadInfo.groupMessages.length >=
    CONFIG.GROUP_LIMIT
  ) {

    if (threadInfo.groupAction)
      return;

    threadInfo.groupAction = true;

    console.log(
      `🚨 GROUP SPAM detected: ${threadID}`
    );

    try {

      await sendMessage(
        api,
        "📴 Too much spam detected.\nBot is leaving this group.",
        threadID
      );

      await new Promise(resolve => {
        try {
          api.removeUserFromGroup(
            api.getCurrentUserID(),
            threadID,
            () => resolve()
          );
        }
        catch {
          resolve();
        }
      });

    }
    catch (err) {

      console.error(
        "❌ Group spam action failed:",
        err?.message || err
      );

      threadInfo.groupAction = false;
    }
  }


  global.antispam.set(
    threadID,
    threadInfo
  );
};


// ============================================================
// REACTION
// ============================================================

module.exports.onReaction = async ({
  api,
  event,
  Reaction,
  role
}) => {

  if (role < 1)
    return;

  if (!Reaction)
    return;

  const uid = normalizeID(Reaction.uid);

  const reactionThreadID =
    normalizeID(Reaction.threadID);

  const threadID =
    normalizeID(event?.threadID || reactionThreadID);

  if (!uid || !threadID)
    return;


  try {

    await api.addUserToGroup(
      uid,
      threadID
    );

    if (Reaction.messageID) {
      try {
        await api.unsendMessage(
          Reaction.messageID,
          threadID
        );
      }
      catch (err) {
        console.error(
          "❌ SpamKick unsend failed:",
          err?.message || err
        );
      }
    }


    const threadInfo =
      getThreadData(threadID);

    delete threadInfo.users[uid];

    global.antispam.set(
      threadID,
      threadInfo
    );


    console.log(
      `✅ SpamKick: ${uid} added back to ${threadID}`
    );

  }
  catch (err) {

    console.error(
      `❌ Failed to re-add ${uid}:`,
      err?.message || err
    );
  }
};


// ============================================================
// COMMAND
// ============================================================

module.exports.onStart = async ({
  api,
  event,
  args
}) => {

  const threadID =
    normalizeID(event?.threadID);

  const senderID =
    normalizeID(event?.senderID);

  const action =
    String(args?.[0] || "").toLowerCase();


  // ----------------------------------------------------------
  // ADMIN CHECK
  // ----------------------------------------------------------

  let role = 0;

  try {

    const thread =
      global.db?.allThreadData?.find(
        t => String(t.threadID) === threadID
      );

    const adminIDs =
      thread?.adminIDs || [];

    const config =
      global.GoatBot?.config || {};

    const adminBot =
      (config.adminBot || []).map(normalizeID);

    const ownerBot =
      (config.ownerBot || []).map(normalizeID);

    if (
      ownerBot.includes(senderID) ||
      adminBot.includes(senderID)
    ) {
      role = 2;
    }
    else if (
      adminIDs.map(normalizeID).includes(senderID)
    ) {
      role = 1;
    }

  }
  catch {}


  if (role < 1) {

    return api.sendMessage(
      "⛔ Only group admins can use SpamKick settings.",
      threadID
    );
  }


  // ----------------------------------------------------------
  // ON
  // ----------------------------------------------------------

  if (action === "on") {

    global.antispam.set(
      threadID,
      {
        enabled: true,
        users: {},
        groupMessages: [],
        groupAction: false,
        createdAt: Date.now()
      }
    );

    return api.sendMessage(
      [
        "🟢 SpamKick is ON.",
        "",
        "👤 Fast spam: 8 messages / 10 sec",
        "🚫 Auto kick: 15 messages / 80 sec",
        "📴 Group spam: 500 messages / 5 min"
      ].join("\n"),
      threadID
    );
  }


  // ----------------------------------------------------------
  // OFF
  // ----------------------------------------------------------

  if (action === "off") {

    global.antispam.set(
      threadID,
      {
        enabled: false,
        users: {},
        groupMessages: [],
        groupAction: false,
        createdAt: Date.now()
      }
    );

    return api.sendMessage(
      "🔴 SpamKick is OFF.\nBot will not detect or kick spammers in this group.",
      threadID
    );
  }


  // ----------------------------------------------------------
  // STATUS
  // ----------------------------------------------------------

  if (action === "status") {

    const data =
      getThreadData(threadID);

    const users =
      Object.keys(data.users || {}).length;

    const groupMessages =
      data.groupMessages?.length || 0;

    return api.sendMessage(
      [
        data.enabled
          ? "🟢 SpamKick is ON."
          : "🔴 SpamKick is OFF.",
        "",
        `👤 Tracked users: ${users}`,
        `💬 Group messages: ${groupMessages}`,
        "",
        `⚡ Fast spam: ${CONFIG.FAST_LIMIT} / 10 sec`,
        `🚫 Auto kick: ${CONFIG.KICK_LIMIT} / 80 sec`,
        `📴 Group limit: ${CONFIG.GROUP_LIMIT} / 5 min`
      ].join("\n"),
      threadID
    );
  }


  // ----------------------------------------------------------
  // HELP
  // ----------------------------------------------------------

  return api.sendMessage(
    [
      "⚙️ SpamKick",
      "",
      "spamkick on",
      "spamkick off",
      "spamkick status",
      "",
      "⚡ 8 msg / 10 sec = spam warning",
      "🚫 15 msg / 80 sec = auto kick",
      "📴 500 msg / 5 min = bot leaves"
    ].join("\n"),
    threadID
  );
};