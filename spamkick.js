module.exports.config = {
  name: "spamkick",
  version: "5.0.0",
  author: "Rakib",
  usePrefix: true,

  description: {
    en: "Advanced spam detection, role protection and auto kick system"
  },

  category: "group",

  guide: {
    en:
      "{pn} on\n" +
      "{pn} off\n" +
      "{pn} status"
  },

  countDown: 5,

  /*
   * IMPORTANT:
   * onStart -> role 1+
   * onChat  -> everyone
   * onReaction -> role 1+
   */
  role: {
    onStart: 1,
    onChat: 0,
    onReaction: 1
  }
};


// ============================================================
// GLOBAL STORAGE
// ============================================================

if (!global.antispam) {
  global.antispam = new Map();
}


// ============================================================
// CONFIG
// ============================================================

const FAST_WINDOW = 10 * 1000;
const FAST_LIMIT = 8;

const KICK_WINDOW = 80 * 1000;
const KICK_LIMIT = 15;

const GROUP_WINDOW = 5 * 60 * 1000;
const GROUP_LIMIT = 500;

const NOTIFY_COOLDOWN = 60 * 1000;


// ============================================================
// HELPERS
// ============================================================

function normalizeID(id) {
  return String(id || "");
}


function getThreadData(threadID) {
  if (!global.antispam.has(threadID)) {
    global.antispam.set(threadID, {
      enabled: true,

      users: {},

      /*
       * Group-wide message timestamps.
       */
      groupMessages: [],

      /*
       * Prevent notification spam.
       */
      notifications: {}
    });
  }

  return global.antispam.get(threadID);
}


function getRoleName(role) {
  switch (Number(role)) {
    case 0:
      return "Role 0 • Member";

    case 1:
      return "Role 1 • Group Admin";

    case 2:
      return "Role 2 • Bot Admin";

    case 3:
      return "Role 3 • Premium";

    case 4:
      return "Role 4 • Developer";

    case 5:
      return "Role 5 • Owner";

    default:
      return `Role ${role}`;
  }
}


function canKickRole(role) {
  return role === 0 || role === 3;
}


function getBotID(api) {
  try {
    if (typeof api.getCurrentUserID === "function") {
      return normalizeID(api.getCurrentUserID());
    }
  } catch (err) {
    console.error("[SpamKick] getCurrentUserID error:", err.message);
  }

  return "";
}


/*
 * Same role priority used by handlerEvents.js
 */
function getUserRole(threadData, senderID) {
  const config = global.GoatBot?.config || {};

  const adminBot = (config.adminBot || []).map(normalizeID);
  const devUsers = (config.devUsers || []).map(normalizeID);
  const premiumUsers = (config.premiumUsers || []).map(normalizeID);
  const ownerBot = (config.ownerBot || []).map(normalizeID);

  const uid = normalizeID(senderID);

  if (!uid) return 0;

  const adminBox = threadData?.adminIDs || [];

  const groupAdmins = adminBox.map(admin =>
    normalizeID(
      typeof admin === "object"
        ? admin.id
        : admin
    )
  );


  // Role 5
  if (ownerBot.includes(uid)) {
    return 5;
  }


  // Role 4
  if (devUsers.includes(uid)) {
    return 4;
  }


  // Role 3
  if (premiumUsers.includes(uid)) {

    try {
      const userData = global.db?.allUserData?.find(
        u => normalizeID(u.userID) === uid
      );

      if (
        userData &&
        userData.data &&
        userData.data.premiumExpireTime
      ) {
        if (
          userData.data.premiumExpireTime < Date.now()
        ) {

          /*
           * Expired premium falls through
           * to lower group roles.
           */

          if (adminBot.includes(uid)) {
            return 2;
          }

          if (groupAdmins.includes(uid)) {
            return 1;
          }

          return 0;
        }
      }
    } catch (err) {
      console.error(
        "[SpamKick] Premium role check error:",
        err.message
      );
    }

    return 3;
  }


  // Role 2
  if (adminBot.includes(uid)) {
    return 2;
  }


  // Role 1
  if (groupAdmins.includes(uid)) {
    return 1;
  }


  // Role 0
  return 0;
}


// ============================================================
// GET GROUP + BOT ADMIN STATUS
// ============================================================

async function getGroupStatus(api, threadID) {

  const result = {
    threadInfo: null,
    botID: "",
    botIsAdmin: false,
    adminIDs: []
  };


  try {

    result.threadInfo =
      await api.getThreadInfo(threadID);

    result.adminIDs =
      (result.threadInfo.adminIDs || []).map(admin =>
        normalizeID(
          typeof admin === "object"
            ? admin.id
            : admin
        )
      );


    result.botID = getBotID(api);

    if (result.botID) {
      result.botIsAdmin =
        result.adminIDs.includes(result.botID);
    }

  } catch (err) {

    console.error(
      "[SpamKick] getThreadInfo error:",
      err.message
    );

  }

  return result;
}


// ============================================================
// NOTIFICATION CONTROL
// ============================================================

function canNotify(threadInfo, key) {

  const now = Date.now();

  const last =
    threadInfo.notifications[key] || 0;

  if (
    now - last <
    NOTIFY_COOLDOWN
  ) {
    return false;
  }

  threadInfo.notifications[key] = now;

  return true;
}


// ============================================================
// USER NAME
// ============================================================

async function getUserName(usersData, uid) {

  try {

    if (
      usersData &&
      typeof usersData.getName === "function"
    ) {
      return await usersData.getName(uid);
    }

  } catch (err) {

    console.error(
      "[SpamKick] getName error:",
      err.message
    );

  }

  return "User";
}


// ============================================================
// CLEAN USER DATA
// ============================================================

function cleanupUser(userData, now) {

  if (!userData) return;


  userData.fastMessages =
    (userData.fastMessages || [])
      .filter(t =>
        now - t < FAST_WINDOW
      );


  userData.kickMessages =
    (userData.kickMessages || [])
      .filter(t =>
        now - t < KICK_WINDOW
      );
}


// ============================================================
// ON CHAT
// ============================================================

module.exports.onChat = async function ({
  api,
  event,
  usersData
}) {

  const {
    senderID,
    threadID
  } = event;


  if (!senderID || !threadID) {
    return;
  }


  const data =
    getThreadData(threadID);


  /*
   * SpamKick disabled
   */
  if (data.enabled !== true) {
    return;
  }


  const uid =
    normalizeID(senderID);


  const now =
    Date.now();


  // ==========================================================
  // GET GROUP INFO
  // ==========================================================

  let groupStatus;

  try {

    groupStatus =
      await getGroupStatus(
        api,
        threadID
      );

  } catch (err) {

    console.error(
      "[SpamKick] Group status error:",
      err.message
    );

    return;
  }


  const threadInfo =
    groupStatus.threadInfo;


  /*
   * If group information cannot be obtained,
   * do not attempt a kick.
   */
  if (!threadInfo) {
    return;
  }


  // ==========================================================
  // USER ROLE
  // ==========================================================

  const role =
    getUserRole(
      threadInfo,
      uid
    );


  const roleName =
    getRoleName(role);


  // ==========================================================
  // GROUP-WIDE SPAM COUNTER
  // ==========================================================

  data.groupMessages =
    (data.groupMessages || [])
      .filter(t =>
        now - t < GROUP_WINDOW
      );


  /*
   * Count ALL messages for group-wide protection.
   *
   * Even protected roles are counted here.
   */
  data.groupMessages.push(now);


  // ==========================================================
  // GROUP SPAM
  // ==========================================================

  if (
    data.groupMessages.length >=
    GROUP_LIMIT
  ) {

    if (
      canNotify(
        data,
        "group-spam"
      )
    ) {

      try {

        await api.sendMessage(
          {
            body:
              "🚨 GROUP SPAM ALERT\n\n" +
              `📊 Messages: ${data.groupMessages.length}/${GROUP_LIMIT}\n` +
              "⏱️ Window: 5 minutes\n" +
              "⚠️ Too much spam detected.\n\n" +
              "🤖 SpamKick is leaving this group."
          },
          threadID
        );

      } catch (err) {

        console.error(
          "[SpamKick] Group warning failed:",
          err.message
        );

      }
    }


    /*
     * Bot leaves group.
     */
    try {

      await api.removeUserFromGroup(
        getBotID(api),
        threadID
      );

    } catch (err) {

      console.error(
        "[SpamKick] Failed to leave group:",
        err.message
      );
    }


    return;
  }


  // ==========================================================
  // ROLE INFORMATION
  // ==========================================================

  /*
   * Protected roles:
   *
   * Role 1 = Group Admin
   * Role 2 = Bot Admin
   * Role 4 = Developer
   * Role 5 = Owner
   *
   * They are NOT kicked.
   */


  if (!canKickRole(role)) {

    /*
     * Do not track individual spam
     * for protected roles.
     *
     * But notify once if they reach
     * the fast spam threshold.
     */

    const protectedUser =
      data.users[uid] ||
      {
        fastMessages: [],
        kickMessages: [],
        protectedNotified: false
      };


    protectedUser.fastMessages =
      (protectedUser.fastMessages || [])
        .filter(t =>
          now - t < FAST_WINDOW
        );


    protectedUser.fastMessages.push(now);


    if (
      protectedUser.fastMessages.length >=
        FAST_LIMIT &&
      !protectedUser.protectedNotified
    ) {

      protectedUser.protectedNotified =
        true;


      try {

        const name =
          await getUserName(
            usersData,
            uid
          );


        await api.sendMessage(
          {
            body:
              "⚠️ SPAM DETECTED\n\n" +
              `👤 User: ${name}\n` +
              `🆔 UID: ${uid}\n` +
              `🛡️ ${roleName}\n\n` +
              "🚫 This role is protected.\n" +
              "❌ SpamKick will NOT kick this user."
          },
          threadID
        );

      } catch (err) {

        console.error(
          "[SpamKick] Protected notification error:",
          err.message
        );

      }
    }


    data.users[uid] =
      protectedUser;

    global.antispam.set(
      threadID,
      data
    );

    return;
  }


  // ==========================================================
  // KICKABLE USER
  // ==========================================================

  let userData =
    data.users[uid];


  if (!userData) {

    userData = {
      fastMessages: [],
      kickMessages: [],
      kicking: false,
      warned: false,
      protectedNotified: false
    };

    data.users[uid] =
      userData;
  }


  cleanupUser(
    userData,
    now
  );


  userData.fastMessages.push(
    now
  );

  userData.kickMessages.push(
    now
  );


  // ==========================================================
  // FAST WARNING
  // ==========================================================

  if (
    userData.fastMessages.length >=
      FAST_LIMIT &&
    !userData.warned
  ) {

    userData.warned =
      true;


    try {

      const name =
        await getUserName(
          usersData,
          uid
        );


      await api.sendMessage(
        {
          body:
            "⚠️ SPAM WARNING\n\n" +
            `👤 User: ${name}\n` +
            `🆔 UID: ${uid}\n` +
            `🛡️ ${roleName}\n` +
            `📊 ${userData.fastMessages.length}/${FAST_LIMIT} messages in 10s\n\n` +
            "⚠️ Please stop spamming."
        },
        threadID
      );

    } catch (err) {

      console.error(
        "[SpamKick] Warning failed:",
        err.message
      );

    }
  }


  // ==========================================================
  // KICK LIMIT
  // ==========================================================

  if (
    userData.kickMessages.length <
    KICK_LIMIT
  ) {

    global.antispam.set(
      threadID,
      data
    );

    return;
  }


  /*
   * Already kicking.
   */
  if (userData.kicking) {
    return;
  }


  userData.kicking =
    true;


  // ==========================================================
  // CHECK BOT ADMIN STATUS
  // ==========================================================

  if (!groupStatus.botIsAdmin) {

    /*
     * Bot is NOT admin.
     *
     * Do not call removeUserFromGroup().
     */

    if (
      canNotify(
        data,
        `bot-not-admin-${threadID}`
      )
    ) {

      try {

        const name =
          await getUserName(
            usersData,
            uid
          );


        await api.sendMessage(
          {
            body:
              "⚠️ SPAMMER DETECTED\n\n" +
              `👤 User: ${name}\n` +
              `🆔 UID: ${uid}\n` +
              `🛡️ ${roleName}\n\n` +
              "🤖 Bot Admin: ❌ NO\n" +
              "🚫 Kick করা সম্ভব নয়।\n\n" +
              "ℹ️ Bot-কে Group Admin দিলে " +
              "SpamKick কাজ করবে."
          },
          threadID
        );

      } catch (err) {

        console.error(
          "[SpamKick] Bot-not-admin notification error:",
          err.message
        );

      }
    }


    /*
     * Keep the counter.
     * Do NOT reset.
     */
    userData.kicking =
      false;


    global.antispam.set(
      threadID,
      data
    );

    return;
  }


  // ==========================================================
  // BOT IS ADMIN
  // ==========================================================

  try {

    const name =
      await getUserName(
        usersData,
        uid
      );


    /*
     * Inform before kick.
     */
    if (
      canNotify(
        data,
        `kick-${uid}`
      )
    ) {

      try {

        await api.sendMessage(
          {
            body:
              "🚨 SPAMMER DETECTED\n\n" +
              `👤 User: ${name}\n` +
              `🆔 UID: ${uid}\n` +
              `🛡️ ${roleName}\n` +
              `📊 ${userData.kickMessages.length}/${KICK_LIMIT}\n\n` +
              "🤖 Bot Admin: ✅ YES\n" +
              "🔨 Action: KICK"
          },
          threadID
        );

      } catch (notifyErr) {

        console.error(
          "[SpamKick] Kick notification error:",
          notifyErr.message
        );

      }
    }


    // ========================================================
    // KICK
    // ========================================================

    await new Promise(
      (resolve, reject) => {

        api.removeUserFromGroup(
          uid,
          threadID,
          err => {

            if (err) {
              return reject(err);
            }

            resolve();
          }
        );

      }
    );


    // ========================================================
    // KICK SUCCESS
    // ========================================================

    let info = null;


    try {

      info =
        await api.sendMessage(
          {
            body:
              `🚫 ${name} has been removed for spamming.\n` +
              `🆔 UID: ${uid}\n` +
              `🛡️ ${roleName}\n` +
              "🤖 Bot Admin: ✅ YES\n\n" +
              "👉 React to add again."
          },
          threadID
        );

    } catch (sendErr) {

      console.error(
        "[SpamKick] Kick result message error:",
        sendErr.message
      );

    }


    /*
     * Reaction handler
     */
    if (
      info &&
      info.messageID &&
      global.GoatBot &&
      global.GoatBot.onReaction
    ) {

      global.GoatBot.onReaction.set(
        info.messageID,
        {
          commandName: "spamkick",
          uid,
          messageID: info.messageID,
          threadID
        }
      );

    }


    console.log(
      `[SpamKick] SUCCESS | UID=${uid} | ROLE=${role} | THREAD=${threadID}`
    );


    /*
     * SUCCESS → reset
     */
    delete data.users[uid];


  } catch (err) {

    // ========================================================
    // KICK FAILED
    // ========================================================

    console.error(
      `[SpamKick] FAILED | UID=${uid} | ROLE=${role}:`,
      err
    );


    /*
     * IMPORTANT:
     *
     * Kick failed → counter reset হবে না।
     * পরের message এ আবার attempt করা যাবে।
     */

    userData.kicking =
      false;


    /*
     * Inform user that kick failed.
     */
    if (
      canNotify(
        data,
        `kick-failed-${uid}`
      )
    ) {

      try {

        await api.sendMessage(
          {
            body:
              "❌ SPAMKICK FAILED\n\n" +
              `🆔 UID: ${uid}\n` +
              `🛡️ ${roleName}\n` +
              "🤖 Bot Admin: ✅ YES\n" +
              "⚠️ Facebook user-কে remove করতে দেয়নি।\n\n" +
              "ℹ️ Counter রাখা হয়েছে; " +
              "পরের spam attempt-এ আবার চেষ্টা করা হবে."
          },
          threadID
        );

      } catch (notifyErr) {

        console.error(
          "[SpamKick] Failure notification error:",
          notifyErr.message
        );

      }
    }

  }


  global.antispam.set(
    threadID,
    data
  );
};


// ============================================================
// ON REACTION
// ============================================================

module.exports.onReaction = async function ({
  api,
  event,
  Reaction,
  role
}) {

  /*
   * Only role 1+ can restore.
   */
  if (Number(role) < 1) {
    return;
  }


  const {
    uid,
    messageID,
    threadID: reactionThreadID
  } = Reaction || {};


  const threadID =
    event.threadID ||
    reactionThreadID;


  if (!uid || !threadID) {
    return;
  }


  try {

    /*
     * Check bot admin before adding.
     */
    const groupStatus =
      await getGroupStatus(
        api,
        threadID
      );


    if (!groupStatus.botIsAdmin) {

      await api.sendMessage(
        {
          body:
            "❌ | Bot Group Admin নয়।\n" +
            "User-কে আবার group-এ add করা সম্ভব নয়."
        },
        threadID
      );

      return;
    }


    await api.addUserToGroup(
      uid,
      threadID
    );


    if (messageID) {

      try {

        await api.unsendMessage(
          messageID,
          threadID
        );

      } catch (err) {

        console.error(
          "[SpamKick] Unsend failed:",
          err.message
        );

      }
    }


    const data =
      getThreadData(threadID);


    delete data.users[
      normalizeID(uid)
    ];


    data.notifications =
      data.notifications || {};


    global.antispam.set(
      threadID,
      data
    );


    console.log(
      `[SpamKick] RESTORED | UID=${uid} | THREAD=${threadID}`
    );


  } catch (err) {

    console.error(
      "[SpamKick] Failed to restore user:",
      err.message
    );


    try {

      await api.sendMessage(
        {
          body:
            `❌ | User-কে আবার add করা যায়নি.\n` +
            `UID: ${uid}\n` +
            `Error: ${err.message || "Unknown error"}`
        },
        threadID
      );

    } catch (_) {}
  }
};


// ============================================================
// ON START
// ============================================================

module.exports.onStart = async function ({
  api,
  event,
  args
}) {

  const threadID =
    event.threadID;


  const action =
    String(
      args[0] || ""
    ).toLowerCase();


  /*
   * Get group info.
   */
  let threadInfo;

  try {

    threadInfo =
      await api.getThreadInfo(
        threadID
      );

  } catch (err) {

    return api.sendMessage(
      "❌ | Group information নেওয়া যাচ্ছে না.",
      threadID
    );
  }


  /*
   * Check command user's role.
   */
  const userRole =
    getUserRole(
      threadInfo,
      event.senderID
    );


  if (userRole < 1) {

    return api.sendMessage(
      "❌ | এই command ব্যবহার করার permission নেই.",
      threadID
    );

  }


  const data =
    getThreadData(
      threadID
    );


  // ==========================================================
  // ON
  // ==========================================================

  if (action === "on") {

    data.enabled =
      true;

    data.users = {};

    data.groupMessages = [];

    data.notifications = {};

    global.antispam.set(
      threadID,
      data
    );


    return api.sendMessage(
      "🟢 SPAMKICK ON\n\n" +
      "👤 Role 0 → KICK\n" +
      "💎 Role 3 → KICK\n" +
      "🛡️ Role 1/2/4/5 → PROTECTED\n\n" +
      "⚡ 8 messages / 10s → Warning\n" +
      "🔨 15 messages / 80s → Kick\n" +
      "🚨 500 messages / 5min → Group protection",
      threadID
    );

  }


  // ==========================================================
  // OFF
  // ==========================================================

  if (action === "off") {

    data.enabled =
      false;

    data.users = {};

    data.groupMessages = [];

    data.notifications = {};

    global.antispam.set(
      threadID,
      data
    );


    return api.sendMessage(
      "🔴 SPAMKICK OFF\n\n" +
      "Bot আর automatic spammer kick করবে না.",
      threadID
    );

  }


  // ==========================================================
  // STATUS
  // ==========================================================

  if (action === "status") {

    const adminIDs =
      (threadInfo.adminIDs || [])
        .map(admin =>
          normalizeID(
            typeof admin === "object"
              ? admin.id
              : admin
          )
        );


    const botID =
      getBotID(api);


    const botIsAdmin =
      botID &&
      adminIDs.includes(botID);


    return api.sendMessage(
      "🛡️ SPAMKICK STATUS\n\n" +

      `Status: ${
        data.enabled
          ? "🟢 ON"
          : "🔴 OFF"
      }\n\n` +

      "👥 ROLE SYSTEM\n" +
      "• Role 0 → 🔨 KICK\n" +
      "• Role 1 → 🛡️ PROTECTED\n" +
      "• Role 2 → 🛡️ PROTECTED\n" +
      "• Role 3 → 🔨 KICK\n" +
      "• Role 4 → 🛡️ PROTECTED\n" +
      "• Role 5 → 🛡️ PROTECTED\n\n" +

      "🤖 BOT ADMIN STATUS\n" +
      `• Bot UID: ${botID || "Unknown"}\n` +
      `• Admin: ${
        botIsAdmin
          ? "✅ YES"
          : "❌ NO"
      }\n\n` +

      "⚡ LIMITS\n" +
      "• Warning: 8 / 10 seconds\n" +
      "• Kick: 15 / 80 seconds\n" +
      "• Group: 500 / 5 minutes",
      threadID
    );

  }


  // ==========================================================
  // HELP
  // ==========================================================

  return api.sendMessage(
    "⚙️ SPAMKICK\n\n" +
    "spamkick on\n" +
    "spamkick off\n" +
    "spamkick status\n\n" +

    "🛡️ Role 1/2/4/5 protected\n" +
    "🔨 Role 0/3 kickable\n\n" +

    "⚡ 8 msg / 10 sec → Warning\n" +
    "🔨 15 msg / 80 sec → Kick\n" +
    "🚨 500 msg / 5 min → Group protection",
    threadID
  );
};
