module.exports = {
  config: {
    name: "count",
    aliases: ["c"],
    version: "1.2",
    author: "Rakib",
    countDown: 5,
    role: 0,
    shortDescription: "Message count",
    longDescription: "Show member message ranking and group total message",
    category: "group",
    guide: "{pn} all"
  },

  onStart: async function ({
    api,
    event,
    args,
    message,
    threadsData,
    usersData
  }) {
    const threadID = event.threadID;

    try {
      // ==============================
      // GET MEMBERS DATA
      // ==============================
      let members = await threadsData.get(threadID, "members");

      if (!Array.isArray(members)) {
        members = [];
      }

      // ==============================
      // GET CURRENT GROUP MEMBERS
      // ==============================
      let participantIDs = [];

      try {
        const threadInfo = await api.getThreadInfo(threadID);

        if (Array.isArray(threadInfo?.participantIDs)) {
          participantIDs = threadInfo.participantIDs.map(String);
        }
      } catch (err) {
        console.error(
          "[COUNT] Failed to get participantIDs:",
          err.message
        );
      }

      // ==============================
      // UPDATE IN-GROUP STATUS
      // ==============================
      const arraySortAll = members
        .filter(user => user && user.userID)
        .map(user => {
          const userID = String(user.userID);

          let inGroup;

          if (participantIDs.length > 0) {
            inGroup = participantIDs.includes(userID);
          } else {
            inGroup = user.inGroup !== false;
          }

          return {
            ...user,
            userID,
            count: Number(user.count) || 0,
            inGroup
          };
        });

      // ==============================
      // CURRENT ACTIVE MEMBERS
      // ==============================
      const arraySort = arraySortAll.filter(
        user => user.inGroup === true
      );

      // ==============================
      // SORT ALL MEMBERS
      // Highest count first
      // ==============================
      arraySortAll.sort((a, b) => {
        return (
          (Number(b.count) || 0) -
          (Number(a.count) || 0)
        );
      });

      // ==============================
      // SORT ACTIVE MEMBERS
      // ==============================
      arraySort.sort((a, b) => {
        return (
          (Number(b.count) || 0) -
          (Number(a.count) || 0)
        );
      });

      // ==============================
      // MEMBER TOTAL
      // ==============================
      const memberTotal = arraySortAll.reduce(
        (sum, user) =>
          sum + (Number(user.count) || 0),
        0
      );

      // ==============================
      // MANUAL GROUP COUNT
      //
      // addcount command saves here:
      // threadsData -> manualCount
      // ==============================
      let manualCount =
        await threadsData.get(threadID, "manualCount");

      manualCount = Number(manualCount) || 0;

      // ==============================
      // FINAL GROUP TOTAL
      // ==============================
      const groupTotalMessages =
        memberTotal + manualCount;

      // ==============================
      // ACTIVE MEMBER TOTAL
      // ==============================
      const activeMemberMessages =
        arraySort.reduce(
          (sum, user) =>
            sum + (Number(user.count) || 0),
          0
        );

      // ==============================
      // COMMAND CHECK
      // ==============================
      const subCommand = String(
        args[0] || ""
      ).toLowerCase();

      if (
        subCommand !== "all" &&
        subCommand !== ""
      ) {
        return message.reply(
          "❌ Invalid command.\n\n" +
          "Use:\n" +
          `${global.GoatBot?.config?.prefix || "."}count all`
        );
      }

      // ==============================
      // PAGE DATA
      // ==============================
      const splitPage =
        global.utils.splitPage(
          arraySortAll,
          50
        );

      if (!splitPage.length) {
        return message.reply(
          "📊 No message count data found."
        );
      }

      const page = 1;

      // ==============================
      // BUILD PAGE
      // ==============================
      const buildMessage = (
        currentPage,
        pageData
      ) => {
        let msg = "";

        msg += "╭───────────────╮\n";
        msg += "│  MESSAGE RANK  │\n";
        msg += "╰───────────────╯\n\n";

        msg += `🌐 Group Total Message: ${groupTotalMessages.toLocaleString()}\n`;
        msg += `👥 Active Member Message: ${activeMemberMessages.toLocaleString()}\n`;
        msg += `📄 This Page Message: ${pageData.reduce(
          (sum, user) =>
            sum + (Number(user.count) || 0),
          0
        ).toLocaleString()}\n`;

        if (manualCount > 0) {
          msg += `➕ Added Message: ${manualCount.toLocaleString()}\n`;
        }

        msg += "\n";

        pageData.forEach((user, index) => {
          const globalIndex =
            (currentPage - 1) * 50 +
            index +
            1;

          const count =
            Number(user.count) || 0;

          const name =
            user.name ||
            user.nickname ||
            "Unknown User";

          const leftMark =
            user.inGroup === false
              ? " 🚪"
              : "";

          let medal = "▫️";

          if (globalIndex === 1) {
            medal = "🥇";
          } else if (globalIndex === 2) {
            medal = "🥈";
          } else if (globalIndex === 3) {
            medal = "🥉";
          }

          msg += `${medal} ${name}${leftMark}: ${count.toLocaleString()}\n`;
        });

        msg += "\n";
        msg += "╭────────────────────╮\n";
        msg += `│ Page [${currentPage}/${splitPage.length}] │\n`;
        msg += "╰────────────────────╯\n";

        if (splitPage.length > 1) {
          msg +=
            "\nReply to this message with the page number to view more.";
        }

        msg +=
          "\nThose who do not have a name in the list have not sent any messages.";

        return msg;
      };

      const msg = buildMessage(
        page,
        splitPage[0]
      );

      // ==============================
      // SEND MESSAGE
      // ==============================
      const sentMessage = await message.reply(msg);

      // ==============================
      // REPLY LISTENER
      // ==============================
      if (
        splitPage.length > 1 &&
        sentMessage?.messageID
      ) {
        global.GoatBot.onReply.set(
          sentMessage.messageID,
          {
            commandName: this.config.name,
            author: event.senderID,
            threadID,
            splitPage,
            groupTotalMessages,
            activeMemberMessages,
            manualCount
          }
        );
      }
    } catch (error) {
      console.error(
        "[COUNT] ERROR:",
        error
      );

      return message.reply(
        "❌ Failed to get message count.\n\n" +
        `Error: ${error.message}`
      );
    }
  },

  // =========================================================
  // PAGE NAVIGATION
  // =========================================================
  onReply: async function ({
    api,
    event,
    Reply,
    message
  }) {
    try {
      // Only original user can navigate
      if (
        Reply.author &&
        String(event.senderID) !==
          String(Reply.author)
      ) {
        return;
      }

      const page = parseInt(
        String(event.body || "").trim()
      );

      if (
        !Number.isInteger(page) ||
        page < 1 ||
        page > Reply.splitPage.length
      ) {
        return message.reply(
          `❌ Invalid page.\n\nAvailable pages: 1-${Reply.splitPage.length}`
        );
      }

      const pageData =
        Reply.splitPage[page - 1];

      const pageMessageTotal =
        pageData.reduce(
          (sum, user) =>
            sum + (Number(user.count) || 0),
          0
        );

      let msg = "";

      msg += "╭───────────────╮\n";
      msg += "│  MESSAGE RANK  │\n";
      msg += "╰───────────────╯\n\n";

      msg += `🌐 Group Total Message: ${Number(
        Reply.groupTotalMessages || 0
      ).toLocaleString()}\n`;

      msg += `👥 Active Member Message: ${Number(
        Reply.activeMemberMessages || 0
      ).toLocaleString()}\n`;

      msg += `📄 This Page Message: ${pageMessageTotal.toLocaleString()}\n`;

      if (
        Number(Reply.manualCount || 0) > 0
      ) {
        msg += `➕ Added Message: ${Number(
          Reply.manualCount
        ).toLocaleString()}\n`;
      }

      msg += "\n";

      pageData.forEach((user, index) => {
        const globalIndex =
          (page - 1) * 50 +
          index +
          1;

        const count =
          Number(user.count) || 0;

        const name =
          user.name ||
          user.nickname ||
          "Unknown User";

        const leftMark =
          user.inGroup === false
            ? " 🚪"
            : "";

        let medal = "▫️";

        if (globalIndex === 1) {
          medal = "🥇";
        } else if (globalIndex === 2) {
          medal = "🥈";
        } else if (globalIndex === 3) {
          medal = "🥉";
        }

        msg += `${medal} ${name}${leftMark}: ${count.toLocaleString()}\n`;
      });

      msg += "\n";
      msg += "╭────────────────────╮\n";
      msg += `│ Page [${page}/${Reply.splitPage.length}] │\n`;
      msg += "╰────────────────────╯";

      if (Reply.splitPage.length > 1) {
        msg +=
          "\n\nReply to this message with the page number to view more.";
      }

      return message.reply(msg);
    } catch (error) {
      console.error(
        "[COUNT] REPLY ERROR:",
        error
      );
    }
  },

  // =========================================================
  // COUNT EVERY MESSAGE
  // =========================================================
  onChat: async function ({
    event,
    threadsData,
    usersData
  }) {
    try {
      const threadID = event.threadID;
      const senderID = event.senderID;

      if (!threadID || !senderID) {
        return;
      }

      let members =
        await threadsData.get(
          threadID,
          "members"
        );

      if (!Array.isArray(members)) {
        members = [];
      }

      const userID = String(senderID);

      let member = members.find(
        user =>
          user &&
          String(user.userID) === userID
      );

      // ==============================
      // NEW MEMBER
      // ==============================
      if (!member) {
        let name = "Unknown User";

        try {
          name =
            await usersData.getName(
              senderID
            );
        } catch (e) {}

        members.push({
          userID,
          name,
          nickname: null,
          inGroup: true,
          count: 1
        });
      }

      // ==============================
      // EXISTING MEMBER
      // ==============================
      else {
        member.count =
          (Number(member.count) || 0) +
          1;

        // If they send a message,
        // they are currently in the group.
        member.inGroup = true;

        if (
          !member.name ||
          member.name === "Unknown User"
        ) {
          try {
            member.name =
              await usersData.getName(
                senderID
              );
          } catch (e) {}
        }
      }

      // ==============================
      // SAVE
      // ==============================
      await threadsData.set(
        threadID,
        members,
        "members"
      );
    } catch (error) {
      console.error(
        "[COUNT] onChat ERROR:",
        error.message
      );
    }
  }
};