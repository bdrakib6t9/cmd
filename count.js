module.exports = {
  config: {
    name: "count",
    aliases: ["c"],
    version: "3.1",
    author: "NTKhang & Rakib",
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
        "\n   {pn} all: dùng để xem số lượng tin nhắn của tất cả thành viên",

      en:
        "   {pn}: used to view your message count" +
        "\n   {pn} @tag: used to view message count of tagged users" +
        "\n   {pn} reply: reply to someone's message to view their count" +
        "\n   {pn} [number]: view stats of a specific rank" +
        "\n   {pn} all: used to view message count of all members"
    }
  },

  langs: {
    endMessage:
      "\n💡 𝐌𝐞𝐦𝐛𝐞𝐫𝐬 𝐧𝐨𝐭 𝐨𝐧 𝐭𝐡𝐞 𝐥𝐢𝐬𝐭 𝐡𝐚𝐯𝐞𝐧'𝐭 𝐬𝐞𝐧𝐭 𝐚𝐧𝐲 𝐦𝐞𝐬𝐬𝐚𝐠𝐞𝐬 𝐲𝐞𝐭.",

    page:
      "\n📖 𝐏𝐚𝐠𝐞 [%1/%2]",

    reply:
      "💬 𝐑𝐞𝐩𝐥𝐲 𝐭𝐨 𝐭𝐡𝐢𝐬 𝐦𝐞𝐬𝐬𝐚𝐠𝐞 𝐰𝐢𝐭𝐡 𝐚 𝐩𝐚𝐠𝐞 𝐧𝐮𝐦𝐛𝐞𝐫 𝐭𝐨 𝐯𝐢𝐞𝐰 𝐦𝐨𝐫𝐞",

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
      threadData =
        await threadsData.get(threadID);
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
        Array.isArray(
          threadInfo?.participantIDs
        )
      ) {
        usersInGroup =
          threadInfo.participantIDs
            .map(String);
      }
    } catch {
      usersInGroup = [];
    }

    // ==========================================================
    // FALLBACK
    // ==========================================================

    if (
      usersInGroup.length === 0
    ) {
      usersInGroup =
        members
          .filter(
            user =>
              user &&
              user.userID != null &&
              user.inGroup !== false
          )
          .map(
            user =>
              String(user.userID)
          );
    }

    // ==========================================================
    // ALL HISTORY RANKING
    //
    // Current + left member সবাই থাকবে।
    // ==========================================================

    const arraySortAll = [];

    let groupTotalMessages = 0;

    const charac =
      "️️️️️️️️️️️️️️️️️";

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
        inGroup
      });

      groupTotalMessages +=
        msgCount;
    }

    // ==========================================================
    // SORT ALL
    // ==========================================================

    arraySortAll.sort(
      (a, b) =>
        (Number(b.count) || 0) -
        (Number(a.count) || 0)
    );

    // ==========================================================
    // GLOBAL/HISTORY RANK
    // ==========================================================

    let allRank = 1;

    for (
      const item of arraySortAll
    ) {
      item.stt = allRank++;
    }

    // ==========================================================
    // CURRENT ACTIVE MEMBER RANKING
    // ==========================================================

    const arraySort =
      arraySortAll.filter(
        item =>
          item.inGroup === true
      );

    // ==========================================================
    // ACTIVE MEMBER TOTAL MESSAGE
    // ==========================================================

    const activeMemberMessages =
      arraySort.reduce(
        (total, item) =>
          total +
          (Number(item.count) || 0),
        0
      );

    // ==========================================================
    // CURRENT MEMBER RANK
    // ==========================================================

    let currentRank = 1;

    for (
      const item of arraySort
    ) {
      item.stt = currentRank++;
    }

    // ==========================================================
    // REPLY TO USER
    // ==========================================================

    if (
      type === "message_reply" &&
      messageReply?.senderID
    ) {
      const targetID =
        String(
          messageReply.senderID
        );

      let findUser =
        arraySort.find(
          item =>
            String(item.uid) ===
            targetID
        );

      // left member হলেও data পাওয়া যাবে
      if (!findUser) {
        findUser =
          arraySortAll.find(
            item =>
              String(item.uid) ===
              targetID
          );
      }

      if (findUser) {
        const msg =
          `❀━━━{  𝐔𝐒𝐄𝐑 𝐑𝐀𝐍𝐊𝐈𝐍𝐆  }━━━❀\n` +
          `👤 ${findUser.name}\n` +
          `  ↳ 🏅 𝐑𝐚𝐧𝐤: ${findUser.stt} | 💬 𝐌𝐞𝐬𝐬𝐚𝐠𝐞𝐬: ${findUser.count}\n` +
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
        String(args[0]);

      // ========================================================
      // RANK NUMBER
      // ========================================================

      if (!isNaN(firstArg)) {
        const rankIndex =
          parseInt(
            firstArg,
            10
          );

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
          arraySort[
            rankIndex - 1
          ];

        const msg =
          `❀━━━{  𝐑𝐀𝐍𝐊 ${rankIndex} 𝐒𝐓𝐀𝐓𝐒  }━━━❀\n` +
          `👤 ${findUser.name}\n` +
          `  ↳ 🏅 𝐑𝐚𝐧𝐤: ${findUser.stt} | 💬 𝐌𝐞𝐬𝐬𝐚𝐠𝐞𝐬: ${findUser.count}\n` +
          `❀━━━━━━━━━━━━━━━━━━━❀`;

        return message.reply(msg);
      }

      // ========================================================
      // ALL
      // ========================================================

      if (
        firstArg.toLowerCase() ===
        "all"
      ) {
        let page =
          parseInt(
            args[1],
            10
          );

        if (isNaN(page))
          page = 1;

        if (
          arraySortAll.length === 0
        ) {
          return message.reply(
            "❌ 𝐍𝐨 𝐦𝐞𝐦𝐛𝐞𝐫 𝐝𝐚𝐭𝐚 𝐟𝐨𝐮𝐧𝐝."
          );
        }

        // ======================================================
        // SPLIT ALL HISTORY
        // ======================================================

        const splitPage =
          global.utils.splitPage(
            arraySortAll,
            50
          );

        if (
          page < 1 ||
          page > splitPage.totalPage
        ) {
          return message.reply(
            getLang(
              "invalidPage"
            )
          );
        }

        // ======================================================
        // CURRENT PAGE
        // ======================================================

        const currentPageData =
          splitPage.allPage[
            page - 1
          ] || [];

        let thisPageMessages = 0;

        let listMsg = "";

        for (
          const item of
            currentPageData
        ) {
          const count =
            Number(item.count) || 0;

          if (count <= 0)
            continue;

          const medal =
            item.stt === 1
              ? "🥇"
              : item.stt === 2
              ? "🥈"
              : item.stt === 3
              ? "🥉"
              : `🔹 [${item.stt}]`;

          // left member indicator
          const status =
            item.inGroup
              ? ""
              : " 🚪";

          listMsg +=
            `${medal} ${item.name}${status}: ${count}\n`;

          thisPageMessages +=
            count;
        }

        // ======================================================
        // FINAL ALL MESSAGE
        // ======================================================

        const msg =
          `❀━━━{  𝐌𝐄𝐒𝐒𝐀𝐆𝐄 𝐑𝐀𝐍𝐊  }━━━❀\n` +

          `🌐 𝐆𝐫𝐨𝐮𝐩 𝐓𝐨𝐭𝐚𝐥 𝐌𝐞𝐬𝐬𝐚𝐠𝐞: ${groupTotalMessages}\n` +

          `👥 𝐀𝐜𝐭𝐢𝐯𝐞 𝐌𝐞𝐦𝐛𝐞𝐫 𝐌𝐞𝐬𝐬𝐚𝐠𝐞: ${activeMemberMessages}\n` +

          `📄 𝐓𝐡𝐢𝐬 𝐏𝐚𝐠𝐞 𝐌𝐞𝐬𝐬𝐚𝐠𝐞: ${thisPageMessages}\n` +

          `❀━━━━━━━━━━━━━━━━━━━❀\n` +

          listMsg +

          `❀━━━━━━━━━━━━━━━━━━━❀` +

          getLang(
            "page",
            page,
            splitPage.totalPage
          ) +

          `\n${getLang(
            "reply"
          )}` +

          `${getLang(
            "endMessage"
          )}`;

        return message.reply(
          msg,
          (err, info) => {
            if (err)
              return message.err(err);

            if (
              !info?.messageID
            )
              return;

            global.GoatBot.onReply.set(
              info.messageID,
              {
                commandName,

                messageID:
                  info.messageID,

                splitPage,

                groupTotalMessages,

                activeMemberMessages,

                author:
                  String(senderID)
              }
            );
          }
        );
      }

      // ========================================================
      // MENTION
      // ========================================================

      if (
        event.mentions &&
        typeof event.mentions ===
          "object" &&
        Object.keys(
          event.mentions
        ).length > 0
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

          // left user হলেও count দেখাবে
          if (!findUser) {
            findUser =
              arraySortAll.find(
                item =>
                  String(item.uid) ===
                  targetID
              );
          }

          if (findUser) {
            found = true;

            msg +=
              `\n${getLang(
                "result",
                findUser.name,
                findUser.stt,
                findUser.count
              )}`;
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
        `  ↳ 🏅 𝐑𝐚𝐧𝐤: ${findUser.stt} | 💬 𝐌𝐞𝐬𝐬𝐚𝐠𝐞𝐬: ${findUser.count}\n` +
        `❀━━━━━━━━━━━━━━━━━━━❀`;

      return message.reply(msg);
    }

    // ==========================================================
    // OLD DATA
    // ==========================================================

    const oldUser =
      arraySortAll.find(
        item =>
          String(item.uid) ===
          String(senderID)
      );

    if (oldUser) {
      return message.reply(
        `👤 ${oldUser.name}\n` +
        `💬 আপনার saved message count: ${oldUser.count}`
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
    commandName,
    getLang
  }) => {
    const senderID =
      String(event.senderID);

    const body =
      String(event.body || "");

    const {
      author,
      splitPage,
      groupTotalMessages,
      activeMemberMessages
    } = Reply;

    // শুধু command চালানো user page change করবে
    if (
      String(author) !==
      senderID
    ) {
      return;
    }

    if (
      !splitPage ||
      !Array.isArray(
        splitPage.allPage
      )
    ) {
      return message.reply(
        getLang(
          "invalidPage"
        )
      );
    }

    const page =
      parseInt(
        body,
        10
      );

    if (
      isNaN(page) ||
      page < 1 ||
      page > splitPage.totalPage
    ) {
      return message.reply(
        getLang(
          "invalidPage"
        )
      );
    }

    const currentPageData =
      splitPage.allPage[
        page - 1
      ] || [];

    let thisPageMessages = 0;

    let listMsg = "";

    // ==========================================================
    // PAGE DATA
    // ==========================================================

    for (
      const item of
        currentPageData
    ) {
      const count =
        Number(item.count) || 0;

      if (count <= 0)
        continue;

      const medal =
        item.stt === 1
          ? "🥇"
          : item.stt === 2
          ? "🥈"
          : item.stt === 3
          ? "🥉"
          : `🔹 [${item.stt}]`;

      const status =
        item.inGroup
          ? ""
          : " 🚪";

      listMsg +=
        `${medal} ${item.name}${status}: ${count}\n`;

      thisPageMessages +=
        count;
    }

    // ==========================================================
    // REPLY MESSAGE
    // ==========================================================

    const msg =
      `❀━━━{  𝐌𝐄𝐒𝐒𝐀𝐆𝐄 𝐑𝐀𝐍𝐊  }━━━❀\n` +

      `🌐 𝐆𝐫𝐨𝐮𝐩 𝐓𝐨𝐭𝐚𝐥 𝐌𝐞𝐬𝐬𝐚𝐠𝐞: ${groupTotalMessages}\n` +

      `👥 𝐀𝐜𝐭𝐢𝐯𝐞 𝐌𝐞𝐦𝐛𝐞𝐫 𝐌𝐞𝐬𝐬𝐚𝐠𝐞: ${activeMemberMessages}\n` +

      `📄 𝐓𝐡𝐢𝐬 𝐏𝐚𝐠𝐞 𝐌𝐞𝐬𝐬𝐚𝐠𝐞: ${thisPageMessages}\n` +

      `❀━━━━━━━━━━━━━━━━━━━❀\n` +

      listMsg +

      `❀━━━━━━━━━━━━━━━━━━━❀` +

      getLang(
        "page",
        page,
        splitPage.totalPage
      ) +

      "\n" +

      getLang(
        "reply"
      ) +

      getLang(
        "endMessage"
      );

    message.reply(
      msg,
      (err, info) => {
        if (err)
          return message.err(err);

        if (
          !info?.messageID
        )
          return;

        // পুরোনো page message remove
        try {
          if (
            Reply.messageID
          ) {
            message.unsend(
              Reply.messageID,
              event.threadID
            );
          }
        } catch {}

        // নতুন reply listener
        global.GoatBot.onReply.set(
          info.messageID,
          {
            commandName,

            messageID:
              info.messageID,

            splitPage,

            groupTotalMessages,

            activeMemberMessages,

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
  // User message দিলে count +1 হবে।
  // User leave করলে এই record delete হবে না।
  // আবার join করলে একই record পাওয়া যাবে।
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
        (Number(
          findMember.count
        ) || 0) + 1;

      // আবার active
      findMember.inGroup =
        true;

      // নাম update
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