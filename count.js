module.exports = {
  config: {
    name: "count",
    aliases: ["c"],
    version: "4.1",
    author: "Rakib",
    countDown: 5,
    role: 0,
    shortDescription: "Message count",
    longDescription: "Show group message count",
    category: "group",
    guide: "{pn} all"
  },

  onStart: async function ({
    api,
    event,
    args,
    message,
    threadsData
  }) {
    const threadID = event.threadID;

    try {
      // ==========================================
      // GET FULL THREAD DATA
      // ==========================================
      const threadData =
        await threadsData.get(threadID);

      let members = Array.isArray(threadData?.members)
        ? threadData.members
        : [];

      // ==========================================
      // GET CURRENT PARTICIPANTS
      // ==========================================
      let participantIDs = [];

      try {
        const threadInfo =
          await api.getThreadInfo(threadID);

        participantIDs =
          Array.isArray(threadInfo?.participantIDs)
            ? threadInfo.participantIDs.map(String)
            : [];
      } catch (e) {
        console.log(
          "[COUNT] getThreadInfo error:",
          e.message
        );
      }

      // ==========================================
      // ALL MEMBERS
      // INCLUDING LEFT MEMBERS
      // ==========================================
      const arraySortAll = members
        .filter(user => user && user.userID)
        .map(user => {
          const userID = String(user.userID);

          let inGroup = user.inGroup !== false;

          if (participantIDs.length > 0) {
            inGroup =
              participantIDs.includes(userID);
          }

          return {
            ...user,
            userID,
            count: Number(user.count) || 0,
            inGroup
          };
        });

      // ==========================================
      // ACTIVE MEMBERS
      // ==========================================
      const arraySort =
        arraySortAll.filter(
          user => user.inGroup === true
        );

      // ==========================================
      // SORT
      // ==========================================
      arraySortAll.sort(
        (a, b) =>
          (Number(b.count) || 0) -
          (Number(a.count) || 0)
      );

      arraySort.sort(
        (a, b) =>
          (Number(b.count) || 0) -
          (Number(a.count) || 0)
      );

      // ==========================================
      // MEMBER MESSAGE TOTAL
      // ==========================================
      const memberTotal =
        arraySortAll.reduce(
          (sum, user) =>
            sum + (Number(user.count) || 0),
          0
        );

      // ==========================================
      // MANUAL ADDED COUNT
      // FROM addcount COMMAND
      // ==========================================
      let manualCount = 0;

      try {
        manualCount =
          Number(
            await threadsData.get(
              threadID,
              "manualCount"
            )
          ) || 0;
      } catch (e) {
        manualCount = 0;
      }

      // ==========================================
      // FINAL GROUP TOTAL
      // ==========================================
      const groupTotalMessages =
        memberTotal + manualCount;

      // ==========================================
      // ACTIVE MEMBER TOTAL
      // ==========================================
      const activeMemberMessages =
        arraySort.reduce(
          (sum, user) =>
            sum + (Number(user.count) || 0),
          0
        );

      // ==========================================
      // NO DATA CHECK
      // ==========================================
      if (
        arraySortAll.length === 0 &&
        manualCount === 0
      ) {
        return message.reply(
          "📊 No message count data found."
        );
      }

      // ==========================================
      // PAGE
      // ==========================================
      const splitPage =
        global.utils.splitPage(
          arraySortAll,
          50
        );

      const buildMessage = (
        pageNumber,
        pageData
      ) => {
        const pageTotal =
          pageData.reduce(
            (sum, user) =>
              sum + (Number(user.count) || 0),
            0
          );

        let msg =
          "╭───────────────╮\n" +
          "│  MESSAGE RANK  │\n" +
          "╰───────────────╯\n\n";

        msg +=
          `🌐 Group Total Message: ${groupTotalMessages.toLocaleString()}\n`;

        msg +=
          `👥 Active Member Message: ${activeMemberMessages.toLocaleString()}\n`;

        msg +=
          `📄 This Page Message: ${pageTotal.toLocaleString()}\n`;

        if (manualCount > 0) {
          msg +=
            `➕ Added Message: ${manualCount.toLocaleString()}\n`;
        }

        msg +=
          "╭────────────────────────╮\n";

        pageData.forEach(
          (user, index) => {
            const position =
              (pageNumber - 1) * 50 +
              index +
              1;

            const count =
              Number(user.count) || 0;

            const name =
              user.name ||
              user.nickname ||
              "Unknown User";

            const left =
              user.inGroup === false
                ? " 🚪"
                : "";

            let medal = "▫️";

            if (position === 1)
              medal = "🥇";
            else if (position === 2)
              medal = "🥈";
            else if (position === 3)
              medal = "🥉";

            msg +=
              `${medal} ${name}${left}: ${count.toLocaleString()}\n`;
          }
        );

        msg +=
          "╰────────────────────────╯\n";

        msg +=
          `Page [${pageNumber}/${splitPage.length}]`;

        if (splitPage.length > 1) {
          msg +=
            "\nReply to this message with the page number to view more";
        }

        return msg;
      };

      const sent =
        await message.reply(
          buildMessage(1, splitPage[0])
        );

      if (
        splitPage.length > 1 &&
        sent?.messageID
      ) {
        global.GoatBot.onReply.set(
          sent.messageID,
          {
            commandName: this.config.name,
            author: event.senderID,
            splitPage,
            groupTotalMessages,
            activeMemberMessages,
            manualCount
          }
        );
      }
    } catch (error) {
      console.error(
        "[COUNT ERROR]",
        error
      );

      return message.reply(
        "❌ Count error:\n" +
        error.message
      );
    }
  },

  // ==========================================
  // PAGE REPLY
  // ==========================================
  onReply: async function ({
    event,
    Reply,
    message
  }) {
    if (
      Reply.author &&
      String(event.senderID) !==
        String(Reply.author)
    ) {
      return;
    }

    const page =
      parseInt(
        String(event.body || "").trim()
      );

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > Reply.splitPage.length
    ) {
      return message.reply(
        `❌ Invalid page.\nAvailable: 1-${Reply.splitPage.length}`
      );
    }

    const pageData =
      Reply.splitPage[page - 1];

    const pageTotal =
      pageData.reduce(
        (sum, user) =>
          sum + (Number(user.count) || 0),
        0
      );

    let msg =
      "╭───────────────╮\n" +
      "│  MESSAGE RANK  │\n" +
      "╰───────────────╯\n\n";

    msg +=
      `🌐 Group Total Message: ${Number(
        Reply.groupTotalMessages || 0
      ).toLocaleString()}\n`;

    msg +=
      `👥 Active Member Message: ${Number(
        Reply.activeMemberMessages || 0
      ).toLocaleString()}\n`;

    msg +=
      `📄 This Page Message: ${pageTotal.toLocaleString()}\n`;

    if (Number(Reply.manualCount || 0) > 0) {
      msg +=
        `➕ Added Message: ${Number(
          Reply.manualCount
        ).toLocaleString()}\n`;
    }

    msg +=
      "╭────────────────────────╮\n";

    pageData.forEach(
      (user, index) => {
        const position =
          (page - 1) * 50 +
          index +
          1;

        const count =
          Number(user.count) || 0;

        const name =
          user.name ||
          user.nickname ||
          "Unknown User";

        const left =
          user.inGroup === false
            ? " 🚪"
            : "";

        let medal = "▫️";

        if (position === 1)
          medal = "🥇";
        else if (position === 2)
          medal = "🥈";
        else if (position === 3)
          medal = "🥉";

        msg +=
          `${medal} ${name}${left}: ${count.toLocaleString()}\n`;
      }
    );

    msg +=
      "╰────────────────────────╯\n";

    msg +=
      `Page [${page}/${Reply.splitPage.length}]`;

    return message.reply(msg);
  },

  // ==========================================
  // COUNT MESSAGES
  // ==========================================
  onChat: async function ({
    event,
    threadsData,
    usersData
  }) {
    try {
      const threadID = event.threadID;
      const senderID = event.senderID;

      if (!threadID || !senderID)
        return;

      // GET FULL THREAD DATA
      const threadData =
        await threadsData.get(threadID);

      let members =
        Array.isArray(threadData?.members)
          ? threadData.members
          : [];

      const userID =
        String(senderID);

      let member =
        members.find(
          user =>
            user &&
            String(user.userID) === userID
        );

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
      } else {
        member.count =
          (Number(member.count) || 0) + 1;

        member.inGroup = true;
      }

      // SAVE INSIDE members
      await threadsData.set(
        threadID,
        members,
        "members"
      );
    } catch (error) {
      console.error(
        "[COUNT onChat ERROR]",
        error.message
      );
    }
  }
};