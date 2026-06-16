const { loadBox } = require("../../rakib/customId/ownBox");

module.exports = {
  config: {
    name: "pending",
    version: "3.0",
    author: "Rakib",
    countDown: 5,
    role: 2,
    category: "owner",
    shortDescription: {
      en: "Manage pending groups"
    }
  },

  onReply: async function ({ api, event, Reply, commandName }) {
    if (String(event.senderID) !== String(Reply.author)) return;

    const { body, threadID, messageID } = event;

    const args = body.trim().split(/\s+/);
    const action = args[0]?.toLowerCase();
    const index = parseInt(args[1]);

    if (!index || index < 1 || index > Reply.pending.length)
      return api.sendMessage("⚠️ 𝖨𝗇𝗏𝖺𝗅𝗂𝖽 𝖭𝗎𝗆𝖻𝖾𝗋! Please choose a valid index from the list.", threadID, messageID);

    const targetThread = Reply.pending[index - 1];

    try {

      // ==========================
      // APPROVE GROUP
      // ==========================
      if (action === "add") {

        try {
          await api.handleMessageRequest(
            targetThread.threadID,
            true
          );
        } catch (e) {}

        // সিস্টেম থেকে বটের নিজস্ব প্রিফিক্স গেট করা হচ্ছে
        const botPrefix = global.GoatBot?.config?.prefix || "Non-Prefix / Prefixed";

        const groupWelcomeMsg = 
          `╭━━━━━━━━━━━━━━━━━━━━━━━╮\n` +
          `┃ ❀ 𝗧𝗘𝗦𝗦𝗔 𝗕𝗢𝗧 𝗔𝗖𝗧𝗜𝗩𝗔𝗧𝗘𝗗 ❀ ┃\n` +
          `╰━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
          `🎉 𝗛𝗲𝗹𝗹𝗼 𝗘𝘃𝗲𝗿𝘆𝗼𝗻𝗲!\n\n` +
          `✅ 𝗧𝗘𝗦𝗦𝗔 𝗕𝗢𝗧 has been successfully approved and activated in this group.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🤖 𝗕𝗢𝗧 𝗜𝗡𝗙𝗢\n\n` +
          `🔹 𝗕𝗼𝘁 𝗡𝗮𝗺𝗲 : TESSA BOT\n` +
          `🔹 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : 𝗩𝟯.𝟬\n` +
          `🔹 𝗦𝘁𝗮𝘁𝘂𝘀 : 🟢 Online\n` +
          `🔹 𝗧𝘆𝗽𝗲 : Multi Functional Assistant\n` +
          `🔹 𝗣𝗿𝗲𝗳𝗶𝘅 : [ ${botPrefix} ]\n` + 
          `🔹 𝗟𝗮𝗻𝗴𝘂𝗮𝗴𝗲 : English / Bangla\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `👑 𝗢𝗪𝗡𝗘𝗥 𝗜𝗡𝗙𝗢\n\n` +
          `👤 𝗡𝗮𝗺𝗲 : 𝐇𝐎𝐎𝐍\n` +
          `🛠️ 𝗥𝗼𝗹𝗲 : Supporter & Owner\n` +
          `🌐 𝗣𝗿𝗼𝗷𝗲𝗰𝘁 : TESSA BOT\n` +
          `📩 𝗦𝘂𝗽𝗽𝗼𝗿𝘁 : Contact Owner For Help\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📚 𝗤𝗨𝗜𝗖𝗞 𝗦𝗧𝗔𝗥𝗧\n\n` +
          `➜ help\n` +
          `➜ menu\n` +
          `➜ allcmd\n\n` +
          `Use the commands above to explore all available features.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `💖 Thank you for adding\n` +
          `𝗧𝗘𝗦𝗦𝗔 𝗕𝗢𝗧 to your community.\n\n` +
          `⚡ Powered By Rakib Hasan\n` +
          `🚀 TESSA BOT Official System\n` +
          `╰━━━━━━━━━━━━━━━━━━━━━━━╯`;

        await api.sendMessage(groupWelcomeMsg, targetThread.threadID);

        const ownBox = await loadBox();

        if (ownBox?.length) {

          let groupName = targetThread.name || "Unknown Group";
          let memberCount = "Unknown";

          try {
            const info = await api.getThreadInfo(targetThread.threadID);
            groupName = info.threadName || groupName;
            memberCount = info.participantIDs?.length || "Unknown";
          } catch {}

          let adminName = "Unknown User";

          try {
            const userInfo = await api.getUserInfo(event.senderID);
            adminName = userInfo[event.senderID]?.name || adminName;
          } catch {}

          const logMsg =
            `┏━━━━━━━━━━━━━━━━━━┓\n` +
            `   🟢 𝗕𝗢𝗧 𝗔𝗗𝗗𝗘𝗗 𝗟𝗢𝗚 🟢\n` +
            `┗━━━━━━━━━━━━━━━━━━┛\n\n` +
            `📌 𝗚𝗿𝗼𝘂𝗽: ${groupName}\n` +
            `🆔 𝗧𝗵𝗿𝗲𝗮𝗱 𝗜𝗗: \`${targetThread.threadID}\`\n` +
            `👥 𝗠𝗲𝗺𝗯𝗲𝗿𝘀: ${memberCount}\n` +
            `⚙️ 𝗦𝘁𝗮𝘁𝘂𝘀: Active / Running ✅\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `👤 𝗔𝗽𝗽𝗿𝗼𝘃𝗲𝗱 𝗕𝘆: ${adminName}\n` +
            `🆔 𝗨𝗜𝗗: \`${event.senderID}\``;

          for (const boxID of ownBox) {
            try {
              await api.sendMessage(logMsg, boxID);
            } catch {}
          }
        }

        return api.sendMessage(
          "✅ 𝗦𝘂𝗰𝗰𝗲𝘀𝘀: Group has been approved and welcomed successfully.",
          threadID,
          messageID
        );
      }

      // ==========================
      // REJECT GROUP
      // ==========================
      if (action === "del") {

        const ownBox = await loadBox();

        if (ownBox?.length) {

          let groupName = targetThread.name || "Unknown Group";

          try {
            const info = await api.getThreadInfo(targetThread.threadID);
            groupName = info.threadName || groupName;
          } catch {}

          let adminName = "Unknown User";

          try {
            const userInfo = await api.getUserInfo(event.senderID);
            adminName = userInfo[event.senderID]?.name || adminName;
          } catch {}

          const logMsg =
            `┏━━━━━━━━━━━━━━━━━━┓\n` +
            `   🔴 𝗕𝗢𝗧 𝗥𝗘𝗠𝗢𝗩𝗘𝗗 𝗟𝗢𝗚 🔴\n` +
            `┗━━━━━━━━━━━━━━━━━━┛\n\n` +
            `📌 𝗚𝗿𝗼𝘂𝗽: ${groupName}\n` +
            `🆔 𝗧𝗵𝗿𝗲𝗮𝗱 𝗜𝗗: \`${targetThread.threadID}\`\n` +
            `🚫 𝗥𝗲𝗮𝘀𝗼𝗻: Rejected by Administrator\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `👤 𝗥𝗲𝗺𝗼𝘃𝗲𝗱 𝗕𝘆: ${adminName}\n` +
            `🆔 𝗨𝗜𝗗: \`${event.senderID}\``;

          for (const boxID of ownBox) {
            try {
              await api.sendMessage(logMsg, boxID);
            } catch {}
          }
        }

        try {
          await api.handleMessageRequest(
            targetThread.threadID,
            false
          );
        } catch {}

        try {
          await api.removeUserFromGroup(
            api.getCurrentUserID(),
            targetThread.threadID
          );
        } catch {}

        return api.sendMessage(
          "❌ 𝗦𝘂𝗰𝗰𝗲𝘀𝘀: Group has been rejected and bot left.",
          threadID,
          messageID
        );
      }

    } catch (err) {
      console.log(err);
      return api.sendMessage(
        "❌ 𝗘𝗿𝗿𝗼𝗿: An unexpected error occurred while processing the request.",
        threadID,
        messageID
      );
    }

  },

  onStart: async function ({ api, event, commandName }) {

    const { threadID, messageID } = event;

    try {

      const other =
        await api.getThreadList(100, null, ["OTHER"]) || [];

      const pending =
        await api.getThreadList(100, null, ["PENDING"]) || [];

      const list = [...other, ...pending]
        .filter(item =>
          item.isSubscribed &&
          item.isGroup
        )
        .filter(
          (item, index, self) =>
            index === self.findIndex(
              t => t.threadID === item.threadID
            )
        );

      if (!list.length)
        return api.sendMessage(
          "✨ 𝗡𝗼 𝗣𝗲𝗻𝗱𝗶𝗻𝗴 𝗚𝗿𝗼𝘂𝗽𝘀: Clear! No groups are waiting for approval.",
          threadID,
          messageID
        );

      let msg =
        `┏━━━━━━━━━━━━━━━━━━┓\n` +
        `  📥 𝗣𝗘𝗡𝗗𝗜𝗡𝗚 𝗟𝗜𝗦𝗧 (${list.length})\n` +
        `┗━━━━━━━━━━━━━━━━━━┛\n\n`;

      let number = 1;

      for (const item of list) {
        msg += `  ${number++}. 👥 ${item.name}\n     🆔 \`${item.threadID}\`\n\n`;
      }

      msg +=
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📝 𝗥𝗲𝗽𝗹𝘆 𝘄𝗶𝘁𝗵:\n` +
        `🔹 add <num> ➜ Approve & Join\n` +
        `🔸 del <num> ➜ Reject & Leave`;

      api.sendMessage(
        msg,
        threadID,
        (err, info) => {
          global.GoatBot.onReply.set(
            info.messageID,
            {
              commandName,
              author: event.senderID,
              messageID: info.messageID,
              pending: list
            }
          );
        },
        messageID
      );

    } catch (err) {
      console.log(err);

      return api.sendMessage(
        "❌ 𝗘𝗿𝗿𝗼𝗿: Failed to fetch the pending groups list.",
        threadID,
        messageID
      );
    }
  }
};
