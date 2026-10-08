module.exports = {
  config: {
    name: "count",
    aliases: ["c"],
    version: "3.0",
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
      "\n💡 𝐌e𝐦𝐛𝐞𝐫𝐬 𝐧𝐨𝐭 𝐨𝐧 𝐭𝐡𝐞 𝐥𝐢𝐬𝐭 𝐡𝐚𝐯𝐞𝐧'𝐭 𝐬𝐞𝐧𝐭 𝐚𝐧𝐲 𝐦𝐞𝐬𝐬𝐚𝐠𝐞𝐬 𝐲𝐞𝐭.",

    page:
      "\n📖 𝐏𝐚𝐠𝐞 [%1/%2]",

    reply:
      "💬 𝐑𝐞𝐩𝐥𝐲 𝐭𝐨 𝐭𝐡𝐢𝐬 𝐦𝐞𝐬𝐬𝐚𝐠𝐞 𝐰𝐢𝐭𝐡 𝐚 𝐩𝐚𝐠𝐞 𝐧𝐮𝐦𝐛𝐞𝐫 𝐭𝐨 𝐯𝐢𝐞𝐰 𝐦𝐨𝐫𝐞",

    result:
      "👤 %1 \n  ↳ 🏅 𝐑𝐚𝐧𝐤: %2 | 💬 𝐌𝐞𝐬𝐬𝐚𝐠𝐞𝐬: %3",

    invalidPage:
      "❌ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐩𝐚𝐠𝐞 𝐧𝐮𝐦𝐛𝐞𝐫! 𝐏𝐥ease 𝐭𝐫𝐲 𝐚𝐠𝐚𝐢𝐧."
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
    // GET SAVED MEMBERS
    // ==========================================================

    let threadData = null;

    try {
      threadData = await threadsData.get(threadID);
    } catch (err) {
      threadData = null;
    }

    let members = Array.isArray(threadData?.members)
      ? threadData.members
      : [];

    // ==========================================================
    // GET CURRENT GROUP PARTICIPANTS
    // ==========================================================

    let usersInGroup = [];

    try {
      const threadInfo =
        await api.getThreadInfo(threadID);

      usersInGroup =
        Array.isArray(threadInfo?.participantIDs)
          ? threadInfo.participantIDs.map(String)
          : [];
    } catch (err) {
      usersInGroup = [];
    }

    // ==========================================================
    // FALLBACK CURRENT MEMBERS
    // ==========================================================

    if (usersInGroup.length === 0) {
      usersInGroup = members
        .filter(
          user =>
            user &&
            user.userID != null &&
            user.inGroup !== false
        )
        .map(user => String(user.userID));
    }

    // ==========================================================
    // ALL MEMBER RANKING
    //
    // IMPORTANT:
    // এখানে current + left member সবাই থাকবে।
    // ==========================================================

    const arraySortAll = [];

    let totalGroupMessages = 0;

    const charac =
      "️️️️️️️️️️️️️️️️️";

    for (const user of members) {
      if (!user || user.userID == null)
        continue;

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

      const isCurrentlyInGroup =
        usersInGroup.length > 0
          ? usersInGroup.includes(userID)
          : user.inGroup !== false;

      arraySortAll.push({
        name,
        count: msgCount,
        uid: userID,
        inGroup: isCurrentlyInGroup
      });

      totalGroupMessages += msgCount;
    }

    // ==========================================================
    // SORT ALL MEMBERS
    // ==========================================================

    arraySortAll.sort(
      (a, b) =>
        (Number(b.count) || 0) -
        (Number(a.count) || 0)
    );

    let allRank = 1;

    for (const item of arraySortAll) {
      item.stt = allRank++;
    }

    // ==========================================================
    // CURRENT GROUP RANKING
    //
    // Normal count/rank/reply/mention এর জন্য
    // শুধু বর্তমানে group-এ থাকা member।
    // ==========================================================

    const arraySort =
      arraySortAll.filter(item =>
        usersInGroup.length > 0
          ? usersInGroup.includes(
              String(item.uid)
            )
          : item.inGroup !== false
      );

    // ==========================================================
    // CURRENT GROUP RANK REBUILD
    // ==========================================================

    let currentRank = 1;

    for (const item of arraySort) {
      item.stt = currentRank++;
    }

    // ==========================================================
    // REPLY TO USER MESSAGE
    // ==========================================================

    if (
      type === "message_reply" &&
      messageReply?.senderID
    ) {
      const targetID =
        String(messageReply.senderID);

      // প্রথমে current group খুঁজবে
      let findUser =
        arraySort.find(
          item =>
            String(item.uid) === targetID
        );

      // না পেলে all history থেকে খুঁজবে
      if (!findUser) {
        findUser =
          arraySortAll.find(
            item =>
              String(item.uid) === targetID
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
          parseInt(firstArg, 10);

        if (
          rankIndex < 1 ||
          rankIndex > arraySort.length
        ) {
          return message.reply(
            `❌ এই গ্রুপে মোট ${arraySort.length} জন সক্রিয় মেম্বার আছেন। ` +
            `অনুগ্রহ করে ১ থেকে ${arraySort.length}-এর মধ্যে যেকোনো সংখ্যা দিন!`
          );
        }

        const findUser =
          arraySort[rankIndex - 1];

        const msg =
          `❀━━━{  𝐑𝐀𝐍𝐊 ${rankIndex} 𝐒𝐓𝐀𝐓𝐒  }━━━❀\n` +
          `👤 ${findUser.name}\n` +
          `  ↳ 🏅 𝐑𝐚𝐧𝐤: ${findUser.stt} | 💬 𝐌𝐞𝐬𝐬𝐚𝐠𝐞𝐬: ${findUser.count}\n` +
          `❀━━━━━━━━━━━━━━━━━━━❀`;

        return message.reply(msg);
      }

      // ========================================================
      // ALL
      //
      // এখানে arraySortAll ব্যবহার করা হচ্ছে।
      // তাই LEFT MEMBER-ও থাকবে।
      // ========================================================

      if (
        firstArg.toLowerCase() === "all"
      ) {
        let page =
          parseInt(args[1], 10);

        if (isNaN(page))
          page = 1;

        if (arraySortAll.length === 0) {
          return message.reply(
            "❌ 𝐍𝐨 𝐦𝐞𝐦𝐛𝐞𝐫 𝐝𝐚𝐭𝐚 𝐟𝐨𝐮𝐧𝐝."
          );
        }

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
            getLang("invalidPage")
          );
        }

        const currentPageData =
          splitPage.allPage[
            page - 1
          ] || [];

        let thisPageMessages = 0;

        let listMsg = "";

        for (
          const item of currentPageData
        ) {
          if (
            (Number(item.count) || 0) > 0
          ) {
            const medal =
              item.stt === 1
                ? "🥇"
                : item.stt === 2
                ? "🥈"
                : item.stt === 3
                ? "🥉"
                : `🔹 [${item.stt}]`;

            // LEFT MEMBER INDICATOR
            const status =
              item.inGroup
                ? ""
                : " 🚪";

            listMsg +=
              `${medal} ${item.name}${status}: ${item.count}\n`;

            thisPageMessages +=
              Number(item.count) || 0;
          }
        }

        const msg =
          `❀━━━{  𝐌𝐄𝐒𝐒𝐀𝐆𝐄 𝐑𝐀𝐍𝐊  }━━━❀\n` +
          `𝐓𝐨𝐭𝐚𝐥 𝐦𝐞𝐬𝐬𝐚𝐠𝐞: ${totalGroupMessages}\n` +
          `𝐓𝐡𝐢𝐬 𝐩𝐚𝐠𝐞: ${thisPageMessages}\n` +
          `❀━━━━━━━━━━━━━━━━━━━❀\n` +
          listMsg +
          `❀━━━━━━━━━━━━━━━━━━━❀` +
          getLang(
            "page",
            page,
            splitPage.totalPage
          ) +
          `\n${getLang("reply")}` +
          `${getLang("endMessage")}`;

        return message.reply(
          msg,
          (err, info) => {
            if (err)
              return message.err(err);

            if (!info?.messageID)
              return;

            global.GoatBot.onReply.set(
              info.messageID,
              {
                commandName,
                messageID:
                  info.messageID,

                splitPage,

                totalGroupMessages,

                author:
                  String(senderID)
              }
            );
          }
        );
      }

      // ========================================================
      // MENTIONS
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

          // Current group first
          let findUser =
            arraySort.find(
              item =>
                String(item.uid) ===
                targetID
            );

          // Left member হলেও count দেখাবে
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
    // USER LEFT BUT OLD DATA EXISTS
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
        `💬 আপনার মোট পুরোনো message count: ${oldUser.count}`
      );
    }

    return message.reply(
      "❌ 𝐘𝐨𝐮𝐫 𝐝𝐚𝐭𝐚 𝐧𝐨𝐭 𝐟𝐨𝐮𝐧!"
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
      totalGroupMessages
    } = Reply;

    // শুধু command চালানো user page change করতে পারবে
    if (
      String(author) !==
      senderID
    )
      return;

    if (
      !splitPage ||
      !Array.isArray(
        splitPage.allPage
      )
    ) {
      return message.reply(
        getLang("invalidPage")
      );
    }

    const page =
      parseInt(body, 10);

    if (
      isNaN(page) ||
      page < 1 ||
      page > splitPage.totalPage
    ) {
      return message.reply(
        getLang("invalidPage")
      );
    }

    const arraySort =
      splitPage.allPage[
        page - 1
      ] || [];

    let thisPageMessages = 0;

    let listMsg = "";

    for (
      const item of arraySort
    ) {
      if (
        (Number(item.count) || 0) >
        0
      ) {
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
          `${medal} ${item.name}${status}: ${item.count}\n`;

        thisPageMessages +=
          Number(item.count) || 0;
      }
    }

    const msg =
      `❀━━━{  𝐌𝐄𝐒𝐒𝐀𝐆𝐄 𝐑𝐀𝐍𝐊  }━━━❀\n` +
      `𝐓𝐨𝐭𝐚𝐥 𝐦𝐞𝐬𝐬𝐚𝐠𝐞: ${totalGroupMessages}\n` +
      `𝐓𝐡𝐢𝐬 𝐩𝐚𝐠𝐞: ${thisPageMessages}\n` +
      `❀━━━━━━━━━━━━━━━━━━━❀\n` +
      listMsg +
      `❀━━━━━━━━━━━━━━━━━━━❀` +
      getLang(
        "page",
        page,
        splitPage.totalPage
      ) +
      "\n" +
      getLang("reply") +
      getLang("endMessage");

    message.reply(
      msg,
      (err, info) => {
        if (err)
          return message.err(err);

        if (!info?.messageID)
          return;

        try {
          if (Reply.messageID) {
            message.unsend(
              Reply.messageID,
              event.threadID
            );
          }
        } catch {}

        global.GoatBot.onReply.set(
          info.messageID,
          {
            commandName,

            messageID:
              info.messageID,

            splitPage,

            totalGroupMessages,

            author: senderID
          }
        );
      }
    );
  },

  // ============================================================
  // ON CHAT
  //
  // IMPORTANT:
  // User leave করলে members থেকে delete হবে না।
  // শুধু inGroup false হতে পারে অন্য flow থেকে।
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
    )
      return;

    let members = [];

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
    // FIND EXISTING USER
    // ==========================================================

    let findMember =
      members.find(
        user =>
          user &&
          String(user.userID) ===
            sender
      );

    // ==========================================================
    // NEW USER
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

        // currently active
        inGroup: true,

        // first message
        count: 1
      });
    }

    // ==========================================================
    // EXISTING USER
    // ==========================================================

    else {
      findMember.count =
        (Number(
          findMember.count
        ) || 0) + 1;

      // আবার group-এ active
      findMember.inGroup = true;

      // নাম missing হলে update
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