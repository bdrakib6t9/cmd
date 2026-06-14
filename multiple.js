const axios = require("axios");
const { loadBox } = require("../../rakib/customId/ownBox");
// bot detect cache
const joinTime = {};
const lastMessage = {};
module.exports = {
config: {
name: "multiple",
version: "1.1",
author: "Rakib",
category: "system",
shortDescription: "Anti multiple bot system"
},
run: async function () {},
onEvent: async function ({ api, event }) {
const { threadID, senderID, logMessageType, logMessageData, body } = event;
try {
// =============================
// 1. USER JOIN TRACK
// =============================
if (logMessageType === "log:subscribe") {
const addedUsers = logMessageData.addedParticipants;
for (let user of addedUsers) {
joinTime[user.userFbId] = Date.now();
}
}
// =============================
// 2. DETECT NICK CHANGE (10s)
// =============================
if (logMessageType === "log:user-nickname") {
const uid = logMessageData.participant_id;
if (joinTime[uid] && Date.now() - joinTime[uid] <= 10000) {
await handleBotDetected({ api, threadID, uid, reason: "nickname change fast" });
}
}
// =============================
// 3. MEDIA + BODY DETECT
// =============================
if (
event.attachments?.length > 0 &&
body &&
body.trim().length > 0
) {
await handleBotDetected({ api, threadID, uid: senderID, reason: "media + text" });
}
// =============================
// 4. FAST REPLY DETECT
// =============================
if (body) {
const now = Date.now();
if (lastMessage[senderID]) {
const diff = now - lastMessage[senderID];
if (diff <= 1000 && event.mentions && Object.keys(event.mentions).length > 0) {
await handleBotDetected({ api, threadID, uid: senderID, reason: "fast reply mention" });
}
}
lastMessage[senderID] = now;
}
} catch (err) {
console.log(err);
}
}
};
// =============================
// MAIN HANDLER
// =============================
async function handleBotDetected({ api, threadID, uid, reason }) {
try {
const threadInfo = await api.getThreadInfo(threadID);
const botID = api.getCurrentUserID();
const adminBox = await loadBox();
const ADMIN_LOG_THREAD = adminBox;
const userName = await getUserName(api, uid);
const isAdmin = threadInfo.adminIDs.some(e => e.id == botID);
// ⚠️ warning msg
await api.sendMessage(
`⚠️ multiple bot detected <@${userName}>\nReason: ${reason}\n⏳ 20s এর মধ্যে remove না
করলে action নে ওয়া হবে .`,
threadID,
null,
{ mentions: [{ id: uid, tag: userName }] }
);
// =============================
// ⏳ WAIT 20 SECONDS
// =============================
setTimeout(async () => {
try {
const updatedInfo = await api.getThreadInfo(threadID);
// user এখনও আছে কি না check
const stillExists = updatedInfo.participantIDs.includes(uid);
if (!stillExists) return; // already removed → do nothing
const stillAdmin = updatedInfo.adminIDs.some(e => e.id == botID);
if (stillAdmin) {
// ✅ kick bot
await api.removeUserFromGroup(uid, threadID);
await api.sendMessage(
`✅ Bot removed after warning: ${userName}`,
threadID
);
} else {
// ❌ leave নি জে
await api.sendMessage(
"❌ multiple bot detected, I am leaving now.",
threadID
);
await api.sendMessage(
`⚠️ MULTIPLE BOT DETECTED\nGroup: ${updatedInfo.threadName}\nThreadID:
${threadID}`,
ADMIN_LOG_THREAD
);
await api.removeUserFromGroup(botID, threadID);
}
} catch (err) {
console.log("Delay error:", err);
}
}, 20000); // ⏱️ 20 seconds
} catch (err) {
console.log(err);
}
}
