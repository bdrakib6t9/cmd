module.exports = {
  config: {
    name: "count",
    aliases: ["c"],
    version: "4.0",
    author: "Hoon",
    countDown: 5,
    role: 0,

    description: {
      vi: "Xem số lượng tin nhắn của tất cả thành viên hoặc bản thân",
      en: "View the number of messages of all members or yourself"
    },

    category: "box chat",

    guide: {
      vi:
        "   {pn}: dùng để xem số lượng tin nhắn của bạn" +
        "\n   {pn} @tag: dùng để xem số lượng tin nhắn của những người được tag" +
        "\n   {pn} reply: reply to someone's message to view their count" +
        "\n   {pn} [số]: xem thông tin của người đứng hạng đó" +
        "\n   {pn} all: dùng để xem số lượng tin nhắn của tất cả thành viên" +
        "\n   {pn} all [page]: xem trang cụ thể",

      en:
        "   {pn}: used to view your message count" +
        "\n   {pn} @tag: used to view message count of tagged users" +
        "\n   {pn} reply: reply to someone's message to view their count" +
        "\n   {pn} [number]: view stats of a specific active rank" +
        "\n   {pn} all: used to view message count of all members" +
        "\n   {pn} all [page]: view a specific page"
    }
  },

  langs: {
    page:
      "\n📖 𝐏𝐚𝐠𝐞 [%1/%2]",

    result:
      "👤 %1 \n  ↳ 🏅 𝐑𝐚𝐧𝐤: %2 | 💬 𝐌𝐞𝐬𝐬𝐚𝐠𝐞𝐬: %3",

    invalidPage:
      "❌ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐩𝐚𝐠𝐞 𝐧𝐮𝐦𝐛𝐞𝐫! 𝐏𝐥𝐞𝐚𝐬𝐞 𝐭𝐫𝐲 𝐚𝐠𝐚𝐢𝐧."
  },

  // ============================================================
  // ON START
  // ============================================================

  onStart: async function ({
    args,
    threadsData,
    message,
    event,
    api,
    commandName,
    getLang
  }) {
    const {
      threadID,
      senderID,
      type,
      messageReply
    } = event;

    // ==========================================================
    // GET THREAD MEMBERS
    // ==========================================================

    let threadData = null;

    try {
      threadData = await threadsData.get(threadID);
    } catch {
      threadData = null;
    }

    let members =
      Array.isArray(threadData?.members)
        ? threadData.members
        : [];

    // ==========================================================
    // GET CURRENT GROUP PARTICIPANTS
    // ==========================================================

    let usersInGroup = [];

    try {
      const threadInfo =
        await api.getThreadInfo(threadID);

      if (
        Array.isArray(threadInfo?.participantIDs)
      ) {
        usersInGroup =
          threadInfo.participantIDs.map(String);
      }
    } catch {
      usersInGroup = [];
    }

    // ==========================================================
    // FALLBACK
    // ==========================================================

    if (usersInGroup.length === 0) {
      usersInGroup =
        members
          .filter(
            user =>
              user &&
              user.userID != null &&
              user.inGroup !== false
          )
          .map(user => String(user.userID));
    }

    // ==========================================================
    // BUILD ALL HISTORY DATA
    // ==========================================================

    const arraySortAll = [];

    for (const user of members) {
      if (
        !user ||
        user.userID == null
      ) {
        continue;
      }

      const userID =
        String(user.userID);

      const msgCount =
        Number(user.count) || 0;

      const rawName =
        user.name != null
          ? String(user.name)
          : `User ${userID}`;

      // Invisible character check
      const charac =
        "️️️️️️️️️️️️️️️️️";

      const name =
        rawName.includes(charac)
          ? `Uid: ${userID}`
          : rawName;

      const inGroup =
        usersInGroup.length > 0
          ? usersInGroup.includes(userID)
          : user.inGroup !== false;

      arraySortAll.push({
        name,
        count: msgCount,
        uid: userID,
        inGroup,

        // IMPORTANT:
        // আলাদা rank properties
        allRank: 0,
        activeRank: 0
      });
    }

    // ==========================================================
    // SORT ALL HISTORY
    //
    // 1. বেশি message আগে
    // 2. একই count হলে UID দিয়ে stable order
    //
    // এতে একই count হলে serial random হবে না।
    // ==========================================================

    arraySortAll.sort((a, b) => {
      const countDiff =
        (Number(b.count) || 0) -
        (Number(a.count) || 0);

      if (countDiff !== 0) {
        return countDiff;
      }

      return String(a.uid).localeCompare(
        String(b.uid)
      );
    });

    // ==========================================================
    // ASSIGN PERMANENT/HISTORY RANK
    // ==========================================================

    arraySortAll.forEach((item, index) => {
      item.allRank = index + 1;
    });

    // ==========================================================
    // CURRENT ACTIVE MEMBERS
    // ==========================================================

    const arraySort =
      arraySortAll.filter(
        item => item.inGroup === true
      );

    // ==========================================================
    // ACTIVE RANK
    // ==========================================================

    arraySort.forEach((item, index) => {
      item.activeRank = index + 1;
    });

    // ==========================================================
    // TOTAL MESSAGE
    // ==========================================================

    const groupTotalMessages =
      arraySortAll.reduce(
        (total, item) =>
          total + (Number(item.count) || 0),
        0
      );

    const activeMemberMessages =
      arraySort.reduce(
        (total, item) =>
          total + (Number(item.count) || 0),
        0
      );

    // ==========================================================
    // REPLY TO USER
    // ==========================================================

    if (
      type === "message_reply" &&
      messageReply?.senderID
    ) {
      const targetID =
        String(messageReply.senderID);

      let findUser =
        arraySort.find(
          item =>
            String(item.uid) === targetID
        );

      let isLeftMember = false;

      // Left member হলেও data দেখাবে
      if (!findUser) {
        findUser =
          arraySortAll.find(
            item =>
              String(item.uid) === targetID
          );

        isLeftMember = true;
      }

      if (findUser) {
        const rank =
          isLeftMember
            ? findUser.allRank
            : findUser.activeRank;

        const rankType =
          isLeftMember
            ? "𝐇𝐢𝐬𝐭𝐨𝐫𝐲 𝐑𝐚𝐧𝐤"
            : "𝐀𝐜𝐭𝐢𝐯𝐞 𝐑𝐚𝐧𝐤";

        const status =
          isLeftMember
            ? " 🚪 𝐋𝐞𝐟𝐭"
            : "";

        const msg =
          `❀━━━{  𝐔𝐒𝐄𝐑 𝐑𝐀𝐍𝐊𝐈𝐍𝐆  }━━━❀\n` +
          `👤 ${findUser.name}${status}\n` +
          `  ↳ 🏅 ${rankType}: ${rank}\n` +
          `  ↳ 💬 𝐌𝐞𝐬𝐬𝐚𝐠𝐞𝐬: ${findUser.count}\n` +
          `❀━━━━━━━━━━━━━━━━━━━❀`;

        return message.reply(msg);
      }

      return message.reply(
        "❌ 𝐔𝐬𝐞𝐫 𝐝𝐚𝐭𝐚 𝐧𝐨𝐭 𝐟𝐨𝐮𝐧𝐝!"
      );
    }

    // ==========================================================
    // ARGUMENTS
    // ==========================================================

    if (args?.[0]) {
      const firstArg =
        String(args[0]).trim();

      // ========================================================
      // ALL
      // ========================================================

      if (
        firstArg.toLowerCase() === "all"
      ) {
        let page =
          parseInt(args[1], 10);

        if (isNaN(page)) {
          page = 1;
        }

        if (arraySortAll.length === 0) {
          return message.reply(
            "❌ 𝐍𝐨 𝐦𝐞𝐦𝐛𝐞𝐫 𝐝𝐚𝐭𝐚 𝐟𝐨𝐮𝐧𝐝."
          );
        }

        // ======================================================
        // EXACTLY 50 USERS PER PAGE
        // ======================================================

        const PAGE_SIZE = 50;

        const totalPage =
          Math.ceil(
            arraySortAll.length /
            PAGE_SIZE
          );

        if (
          page < 1 ||
          page > totalPage
        ) {
          return message.reply(
            getLang("invalidPage")
          );
        }

        const startIndex =
          (page - 1) * PAGE_SIZE;

        const currentPageData =
          arraySortAll.slice(
            startIndex,
            startIndex + PAGE_SIZE
          );

        // ======================================================
        // PAGE MESSAGE
        // ======================================================

        let thisPageMessages = 0;

        let listMsg = "";

        for (
          const item of currentPageData
        ) {
          const count =
            Number(item.count) || 0;

          // Count 0 হলে list-এ দেখাবে না
          if (count <= 0) {
            continue;
          }

          const medal =
            item.allRank === 1
              ? "🥇"
              : item.allRank === 2
              ? "🥈"
              : item.allRank === 3
              ? "🥉"
              : `🔹 [${item.allRank}]`;

          // Left member indicator
          const status =
            item.inGroup
              ? ""
              : " 🚪";

          listMsg +=
            `${medal} ${item.name}${status}: ${count}\n`;

          thisPageMessages += count;
        }

        // ======================================================
        // FINAL MESSAGE
        // ======================================================

        const msg =
          `❀━━━{  𝐌𝐄𝐒𝐒𝐀𝐆𝐄 𝐑𝐀𝐍𝐊  }━━━❀\n` +

          `🌐 𝐆𝐫𝐨𝐮𝐩 𝐓𝐨𝐭𝐚𝐥 𝐌𝐞𝐬𝐬𝐚𝐠𝐞: ${groupTotalMessages}\n` +

          `👥 𝐀𝐜𝐭𝐢𝐯𝐞 𝐌𝐞𝐦𝐛𝐞𝐫 𝐌𝐞𝐬𝐬𝐚𝐠𝐞: ${activeMemberMessages}\n` +

          `📄 𝐓𝐡𝐢𝐬 𝐏𝐚𝐠𝐞 𝐌𝐞𝐬𝐬𝐚𝐠𝐞: ${thisPageMessages}\n` +

          `📊 𝐓𝐨𝐭𝐚𝐥 𝐌𝐞𝐦𝐛𝐞𝐫𝐬: ${arraySortAll.length}\n` +

          `📖 𝐏𝐚𝐠𝐞: ${page}/${totalPage}\n` +

          `❀━━━━━━━━━━━━━━━━━━━❀\n` +

          listMsg +

          `❀━━━━━━━━━━━━━━━━━━━❀`;

        return message.reply(
          msg,
          (err, info) => {
            if (err) {
              return message.err(err);
            }

            if (!info?.messageID) {
              return;
            }

            global.GoatBot.onReply.set(
              info.messageID,
              {
                commandName,

                messageID:
                  info.messageID,

                // Store full data so page can be changed
                arraySortAll,

                groupTotalMessages,

                activeMemberMessages,

                totalPage,

                pageSize:
                  PAGE_SIZE,

                author:
                  String(senderID)
              }
            );
          }
        );
      }

      // ========================================================
      // RANK NUMBER
      // ========================================================

      if (!isNaN(firstArg)) {
        const rankIndex =
          parseInt(firstArg, 10);

        if (
          rankIndex < 1 ||
          rankIndex > arraySort.length
        ) {
          return message.reply(
            `❌ এই গ্রুপে মোট ${arraySort.length} জন active member আছেন। ` +
            `১ থেকে ${arraySort.length}-এর মধ্যে সংখ্যা দিন!`
          );
        }

        const findUser =
          arraySort[rankIndex - 1];

        const msg =
          `❀━━━{  𝐑𝐀𝐍𝐊 ${rankIndex} 𝐒𝐓𝐀𝐓𝐒  }━━━❀\n` +
          `👤 ${findUser.name}\n` +
          `  ↳ 🏅 𝐀𝐜𝐭𝐢𝐯𝐞 𝐑𝐚𝐧𝐤: ${findUser.activeRank}\n` +
          `  ↳ 💬 𝐌𝐞𝐬𝐬𝐚𝐠𝐞𝐬: ${findUser.count}\n` +
          `❀━━━━━━━━━━━━━━━━━━━❀`;

        return message.reply(msg);
      }

      // ========================================================
      // MENTION
      // ========================================================

      if (
        event.mentions &&
        typeof event.mentions === "object" &&
        Object.keys(event.mentions).length > 0
      ) {
        let msg =
          "❀━━━{  𝐌𝐄𝐍𝐓𝐈𝐎𝐍 𝐒𝐓𝐀𝐓𝐒  }━━━❀";

        let found = false;

        for (
          const id of Object.keys(
            event.mentions
          )
        ) {
          const targetID =
            String(id);

          let findUser =
            arraySort.find(
              item =>
                String(item.uid) ===
                targetID
            );

          let isLeftMember = false;

          // Left user হলেও count দেখাবে
          if (!findUser) {
            findUser =
              arraySortAll.find(
                item =>
                  String(item.uid) ===
                  targetID
              );

            isLeftMember = true;
          }

          if (findUser) {
            found = true;

            const rank =
              isLeftMember
                ? findUser.allRank
                : findUser.activeRank;

            const rankType =
              isLeftMember
                ? "𝐇𝐢𝐬𝐭𝐨𝐫𝐲"
                : "𝐀𝐜𝐭𝐢𝐯𝐞";

            const status =
              isLeftMember
                ? " 🚪"
                : "";

            msg +=
              `\n👤 ${findUser.name}${status}` +
              `\n  ↳ 🏅 ${rankType} 𝐑𝐚𝐧𝐤: ${rank}` +
              ` | 💬 𝐌𝐞𝐬𝐬𝐚𝐠𝐞𝐬: ${findUser.count}`;
          }
        }

        msg +=
          "\n❀━━━━━━━━━━━━━━━━━━━❀";

        if (!found) {
          return message.reply(
            "❌ 𝐌𝐞𝐧𝐭𝐢𝐨𝐧𝐞𝐝 𝐮𝐬𝐞𝐫 𝐝𝐚𝐭𝐚 𝐧𝐨𝐭 𝐟𝐨𝐮𝐧𝐝!"
          );
        }

        return message.reply(msg);
      }
    }

    // ==========================================================
    // OWN COUNT
    // ==========================================================

    const findUser =
      arraySort.find(
        item =>
          String(item.uid) ===
          String(senderID)
      );

    if (findUser) {
      const msg =
        `❀━━━{  𝐘𝐎𝐔𝐑 𝐑𝐀𝐍𝐊𝐈𝐍𝐆  }━━━❀\n` +
        `👤 ${findUser.name}\n` +
        `  ↳ 🏅 𝐀𝐜𝐭𝐢𝐯𝐞 𝐑𝐚𝐧𝐤: ${findUser.activeRank}\n` +
        `  ↳ 💬 𝐌𝐞𝐬𝐬𝐚𝐠𝐞𝐬: ${findUser.count}\n` +
        `❀━━━━━━━━━━━━━━━━━━━❀`;

      return message.reply(msg);
    }

    // ==========================================================
    // OLD DATA / LEFT USER
    // ==========================================================

    const oldUser =
      arraySortAll.find(
        item =>
          String(item.uid) ===
          String(senderID)
      );

    if (oldUser) {
      return message.reply(
        `❀━━━{  𝐎𝐋𝐃 𝐃𝐀𝐓𝐀  }━━━❀\n` +
        `👤 ${oldUser.name}\n` +
        `  ↳ 🏅 𝐇𝐢𝐬𝐭𝐨𝐫𝐲 𝐑𝐚𝐧𝐤: ${oldUser.allRank}\n` +
        `  ↳ 💬 𝐌𝐞𝐬𝐬𝐚𝐠𝐞𝐬: ${oldUser.count}\n` +
        `🚪 𝐍𝐨𝐭 𝐢𝐧 𝐠𝐫𝐨𝐮𝐩\n` +
        `❀━━━━━━━━━━━━━━━━━━━❀`
      );
    }

    return message.reply(
      "❌ 𝐘𝐨𝐮𝐫 𝐝𝐚𝐭𝐚 𝐧𝐨𝐭 𝐟𝐨𝐮𝐧𝐝!"
    );
  },

  // ============================================================
  // ON REPLY
  // ============================================================

  onReply: ({
    message,
    event,
    Reply,
    commandName
  }) => {
    const senderID =
      String(event.senderID);

    const body =
      String(event.body || "").trim();

    const {
      author,
      arraySortAll,
      groupTotalMessages,
      activeMemberMessages,
      pageSize
    } = Reply;

    // ==========================================================
    // ONLY COMMAND AUTHOR CAN CHANGE PAGE
    // ==========================================================

    if (
      String(author) !==
      senderID
    ) {
      return;
    }

    // ==========================================================
    // VALIDATE DATA
    // ==========================================================

    if (
      !Array.isArray(arraySortAll)
    ) {
      return message.reply(
        "❌ 𝐏𝐚𝐠𝐞 𝐝𝐚𝐭𝐚 𝐞𝐱𝐩𝐢𝐫𝐞𝐝!"
      );
    }

    const PAGE_SIZE =
      Number(pageSize) || 50;

    // ==========================================================
    // PAGE NUMBER
    // ==========================================================

    const page =
      parseInt(body, 10);

    const totalPage =
      Math.ceil(
        arraySortAll.length /
        PAGE_SIZE
      );

    if (
      isNaN(page) ||
      page < 1 ||
      page > totalPage
    ) {
      return message.reply(
        "❌ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐩𝐚𝐠𝐞 𝐧𝐮𝐦𝐛𝐞𝐫!"
      );
    }

    // ==========================================================
    // CURRENT PAGE
    // ==========================================================

    const startIndex =
      (page - 1) * PAGE_SIZE;

    const currentPageData =
      arraySortAll.slice(
        startIndex,
        startIndex + PAGE_SIZE
      );

    // ==========================================================
    // BUILD PAGE
    // ==========================================================

    let thisPageMessages = 0;

    let listMsg = "";

    for (
      const item of currentPageData
    ) {
      const count =
        Number(item.count) || 0;

      if (count <= 0) {
        continue;
      }

      const medal =
        item.allRank === 1
          ? "🥇"
          : item.allRank === 2
          ? "🥈"
          : item.allRank === 3
          ? "🥉"
          : `🔹 [${item.allRank}]`;

      const status =
        item.inGroup
          ? ""
          : " 🚪";

      listMsg +=
        `${medal} ${item.name}${status}: ${count}\n`;

      thisPageMessages += count;
    }

    // ==========================================================
    // REPLY MESSAGE
    // ==========================================================

    const msg =
      `❀━━━{  𝐌𝐄𝐒𝐒𝐀𝐆𝐄 𝐑𝐀𝐍𝐊  }━━━❀\n` +

      `🌐 𝐆𝐫𝐨𝐮𝐩 𝐓𝐨𝐭𝐚𝐥 𝐌𝐞𝐬𝐬𝐚𝐠𝐞: ${groupTotalMessages}\n` +

      `👥 𝐀𝐜𝐭𝐢𝐯𝐞 𝐌𝐞𝐦𝐛𝐞𝐫 𝐌𝐞𝐬𝐬𝐚𝐠𝐞: ${activeMemberMessages}\n` +

      `📄 𝐓𝐡𝐢𝐬 𝐏𝐚𝐠𝐞 𝐌𝐞𝐬𝐬𝐚𝐠𝐞: ${thisPageMessages}\n` +

      `📊 𝐓𝐨𝐭𝐚𝐥 𝐌𝐞𝐦𝐛𝐞𝐫𝐬: ${arraySortAll.length}\n` +

      `❀━━━━━━━━━━━━━━━━━━━❀\n` +

      listMsg +

      `❀━━━━━━━━━━━━━━━━━━━❀\n` +

      `📖 𝐏𝐚𝐠𝐞 [${page}/${totalPage}]`;

    message.reply(
      msg,
      (err, info) => {
        if (err) {
          return message.err(err);
        }

        if (!info?.messageID) {
          return;
        }

        // ======================================================
        // DELETE OLD PAGE MESSAGE
        // ======================================================

        try {
          if (Reply.messageID) {
            message.unsend(
              Reply.messageID,
              event.threadID
            );
          }
        } catch {}

        // ======================================================
        // NEW PAGE LISTENER
        // ======================================================

        global.GoatBot.onReply.set(
          info.messageID,
          {
            commandName,

            messageID:
              info.messageID,

            arraySortAll,

            groupTotalMessages,

            activeMemberMessages,

            totalPage,

            pageSize:
              PAGE_SIZE,

            author:
              senderID
          }
        );
      }
    );
  },

  // ============================================================
  // ON CHAT
  //
  // User message দিলে count +1
  //
  // User leave করলে record delete হবে না
  //
  // আবার join করলে আগের record-ই ব্যবহার হবে
  // ============================================================

  onChat: async ({
    usersData,
    threadsData,
    event
  }) => {
    const {
      senderID,
      threadID
    } = event;

    if (
      !senderID ||
      !threadID
    ) {
      return;
    }

    let members = [];

    // ==========================================================
    // LOAD MEMBERS
    // ==========================================================

    try {
      const data =
        await threadsData.get(
          threadID,
          "members"
        );

      members =
        Array.isArray(data)
          ? data
          : [];
    } catch {
      members = [];
    }

    const sender =
      String(senderID);

    // ==========================================================
    // FIND USER
    // ==========================================================

    let findMember =
      members.find(
        user =>
          user &&
          String(user.userID) ===
            sender
      );

    // ==========================================================
    // NEW MEMBER
    // ==========================================================

    if (!findMember) {
      let name =
        "Unknown User";

      try {
        name =
          await usersData.getName(
            senderID
          );
      } catch {}

      members.push({
        userID: sender,

        name,

        nickname: null,

        inGroup: true,

        count: 1
      });
    }

    // ==========================================================
    // EXISTING MEMBER
    // ==========================================================

    else {
      findMember.count =
        (Number(findMember.count) || 0) + 1;

      // User active again
      findMember.inGroup = true;

      // Update name if missing
      if (
        !findMember.name ||
        findMember.name ===
          "Unknown User"
      ) {
        try {
          findMember.name =
            await usersData.getName(
              senderID
            );
        } catch {}
      }
    }

    // ==========================================================
    // SAVE
    //
    // IMPORTANT:
    // Member record কখনো delete করছি না।
    // ==========================================================

    try {
      await threadsData.set(
        threadID,
        members,
        "members"
      );
    } catch {}
  }
};