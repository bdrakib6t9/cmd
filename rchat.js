const { getStreamsFromAttachment } = global.utils;

const mediaTypes = [                                         "photo",
  "png",
  "animated_image",
  "video",                                                   "audio"
];

const groupCache = Object.create(null);                    
/*
 * ============================================================                                                        * THREAD NAME
 * ============================================================
 */

async function getThreadName(api, tid, info = null) {
  try {
    if (!info && (!api || typeof api.getThreadInfo !== "function")) {
      return "Unknown Group";
    }

    const threadInfo =
      info || await api.getThreadInfo(String(tid));

    if (!threadInfo) {
      return "Unknown Group";
    }

    const possibleNames = [
      threadInfo.threadName,
      threadInfo.name,
      threadInfo.thread_name,
      threadInfo.title,
      threadInfo.chatName,
      threadInfo.threadTitle,
      threadInfo.subject
    ];
                                                               for (const value of possibleNames) {
      if (                                                         value !== null &&
        value !== undefined &&
        String(value).trim() !== "" &&
        String(value).toLowerCase() !== "null"
      ) {
        return String(value).trim();
      }                                                        }
                                                               if (threadInfo.thread) {
      const nestedNames = [
        threadInfo.thread.threadName,                              threadInfo.thread.name,
        threadInfo.thread.title
      ];

      for (const value of nestedNames) {                           if (
          value !== null &&
          value !== undefined &&                                     String(value).trim() !== ""
        ) {
          return String(value).trim();
        }
      }
    }

    return "Unnamed Group";
  } catch (error) {                                            console.log(
      `[RCHAT] Failed to get name for ${tid}:`,
      error?.message || error
    );

    return "Unknown Group";
  }
}                                                          

/*
 * ============================================================
 * GET ACTIVE GROUPS
 * ============================================================
 *
 * Database থেকে candidate নেয়।
 *
 * তারপর getThreadInfo() দিয়ে verify করে যে:
 *
 * 1. Thread এখনো accessible
 * 2. Thread actually group                                 * 3. Current thread বাদ
 *                                                          * getThreadList() ব্যবহার করা হচ্ছে না।
 */
                                                           async function getActiveGroups(api, threadsData, currentThreadID) {
  if (!threadsData || typeof threadsData.getAll !== "function") {
    throw new Error("threadsData.getAll() is unavailable");
  }

  const allThreads = await threadsData.getAll();

  if (!Array.isArray(allThreads)) {
    return [];                                               }

  const currentTID = String(currentThreadID);

  /*
   * First filter DB candidates.
   */
  const candidates = [                                         ...new Map(
      allThreads
        .filter(thread => {
          if (!thread) return false;

          const tid =
            thread.threadID ??                                         thread.threadId ??
            thread.tid;
                                                                     if (!tid) return false;

          if (String(tid) === currentTID) return false;

          /*
           * Only groups.
           */
          return thread.isGroup === true;
        })
        .map(thread => [
          String(
            thread.threadID ??
            thread.threadId ??                                         thread.tid
          ),
          thread
        ])
    ).values()                                               ];

  if (!candidates.length) {                                    return [];
  }
                                                             const activeGroups = [];
                                                             /*
   * Controlled concurrency.                                  *
   * একসাথে সব GC-তে getThreadInfo() পাঠানো হবে না।           */
  const concurrency = 5;
                                                             for (let i = 0; i < candidates.length; i += concurrency) {                                                              const batch = candidates.slice(i, i + concurrency);
                                                               const results = await Promise.all(
      batch.map(async thread => {
        const tid = String(                                          thread.threadID ??
          thread.threadId ??                                         thread.tid
        );                                                 
        try {                                                        const info = await api.getThreadInfo(tid);

          if (!info) {                                                 return null;
          }

          /*
           * Some versions return isGroup,                            * some don't. If explicitly false,
           * reject it.
           */
          if (info.isGroup === false) {                                return null;
          }                                                
          /*                                                          * Make sure it still looks like a group.
           */                                                        const participantIDs = Array.isArray(
            info.participantIDs
          )                                                            ? info.participantIDs
            : [];                                          
          const userInfo =                                             info.userInfo &&
            typeof info.userInfo === "object"                            ? info.userInfo
              : null;
                                                                     const looksLikeGroup =
            info.isGroup === true ||                                   participantIDs.length > 1 ||
            Boolean(userInfo);                             
          if (!looksLikeGroup) {
            return null;                                             }
                                                                     const name = await getThreadName(
            api,                                                       tid,
            info                                                     );

          return {                                                     threadID: tid,
            name
          };
        } catch (error) {
          /*
           * Stale/deleted/inaccessible GC.                           * Silently skip.
           */
          console.log(
            `[RCHAT] Skipping inactive/inaccessible GC ${tid}:`,                                                                  error?.message || "getThreadInfo failed"
          );
                                                                     return null;
        }
      })
    );

    for (const result of results) {
      if (result) {
        activeGroups.push(result);
      }
    }                                                      
    /*
     * Small delay between batches.
     */
    if (i + concurrency < candidates.length) {                   await new Promise(resolve =>
        setTimeout(resolve, 300)
      );
    }
  }

  /*
   * Remove duplicates and sort by name.
   */
  return [
    ...new Map(
      activeGroups.map(group => [                                  String(group.threadID),
        group                                                    ])
    ).values()
  ].sort((a, b) =>                                             String(a.name).localeCompare(
      String(b.name),
      undefined,                                                 {
        sensitivity: "base"
      }
    )
  );
}

                                                           /*
 * ============================================================
 * COMMAND                                                  * ============================================================
 */                                                        
module.exports = {
  config: {
    name: "randomchat",
    aliases: ["rchat"],
    version: "2.0.0",                                          author: "Rakib",
    countDown: 2,

    role: {
      onStart: 4,
      onReply: 0
    },

    shortDescription:
      "Random chat between active groups",

    longDescription:
      "Send messages between currently active group chats",
                                                               category: "Communication",

    guide: {                                                     en:
        "{pn} list" +
        "\n{pn} [Serial] [Message]" +                              "\n{pn} [TID] [Message]"
    }                                                        },
                                                           
  /*                                                          * ==========================================================
   * ON START                                                 * ==========================================================                                                          */
                                                             onStart: async function ({
    api,
    event,                                                     args,
    threadsData,                                               usersData,
    commandName                                              }) {
    const {                                                      threadID,
      messageID,
      senderID,                                                  attachments = []
    } = event;


    /*
     * ========================================================
     * LIST
     * ========================================================
     */
                                                               if (
      String(args[0] || "").toLowerCase() === "list"
    ) {                                                          try {
        const groups = await getActiveGroups(                        api,
          threadsData,                                               threadID
        );                                                 
        if (!groups.length) {
          return api.sendMessage(                                      "❌ No active group chats found.",
            threadID,                                                  messageID
          );                                                       }

        groupCache[threadID] =                                       Object.create(null);
                                                                   let msg =
          "┏━━━❰ ACTIVE GROUP LIST ❱━━━┓\n\n";             
        groups.forEach((group, index) => {                           const serial = index + 1;

          groupCache[threadID][String(serial)] =                       String(group.threadID);

          msg +=
            `${serial}. 🏷️ ${group.name || "Unnamed Group"}\n` +
            `🆔 ${group.threadID}\n\n`;                            });

        msg +=
          "┗━━━━━━━━━━━━━━━━━━━━┛\n\n" +
          "💡 Usage:\n" +                                            ".rchat [Number] [Message]\n" +
          ".rchat [TID] [Message]";
                                                                   return api.sendMessage(
          msg,
          threadID,
          messageID
        );
      } catch (error) {
        console.error(                                               "[RCHAT LIST ERROR]",
          error
        );
                                                                   return api.sendMessage(
          "❌ Failed to fetch active group list.\n" +                "Please try again later.",
          threadID,
          messageID
        );
      }
    }                                                      

    /*
     * ========================================================
     * SEND MESSAGE
     * ========================================================
     */                                                    
    let targetTID = String(args[0] || "").trim();          
    const content = args
      .slice(1)
      .join(" ")                                                 .trim();
                                                               if (!targetTID || !content) {
      return api.sendMessage(                                      "⚠️ Please provide a Serial Number or TID and a message.\n\n" +
        "Example:\n" +
        ".rchat list\n" +                                          ".rchat 3 Hello",
        threadID,                                                  messageID
      );                                                       }


    /*
     * ========================================================
     * SERIAL NUMBER                                            * ========================================================
     */

    if (                                                         /^\d+$/.test(targetTID) &&
      targetTID.length <= 3
    ) {                                                          const cached =
        groupCache[threadID]?.[targetTID];

      if (!cached) {
        return api.sendMessage(
          "❌ Serial number not found.\n\n" +
          "Please run `.rchat list` first.",
          threadID,
          messageID
        );
      }                                                    
      targetTID = String(cached);
    }


    /*
     * ========================================================                                                            * DON'T SEND TO SAME GROUP
     * ========================================================
     */

    if (String(targetTID) === String(threadID)) {                return api.sendMessage(
        "⚠️ You cannot random-chat with the current group.",        threadID,
        messageID                                                );
    }

                                                               /*
     * ========================================================
     * GET SENDER NAME
     * ========================================================
     */

    let senderName = "Unknown User";                       
    try {
      senderName =
        await usersData.getName(senderID);                     } catch {
      // Keep fallback name.
    }                                                      
                                                               /*
     * ========================================================
     * ATTACHMENTS
     * ========================================================
     */

    const replyAttachments =                                     event.messageReply?.attachments || [];

    const validAttachments = [
      ...attachments,                                            ...replyAttachments
    ].filter(item =>
      item &&                                                    mediaTypes.includes(item.type)
    );                                                     
                                                               let attachmentStreams = [];

    try {
      if (validAttachments.length) {
        attachmentStreams =
          await getStreamsFromAttachment(
            validAttachments
          );
      }
    } catch (error) {
      console.error(                                               "[RCHAT ATTACHMENT ERROR]",
        error
      );                                                   
      return api.sendMessage(
        "❌ Failed to process the attachment.",
        threadID,
        messageID                                                );
    }


    /*
     * ========================================================
     * BUILD MESSAGE
     * ========================================================
     */

    const formMessage = {
      body:
        `🔗 Random Connected Group\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 From: ${senderName}\n` +
        `💬 Message: ${content}\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `↩️ Reply to this message to send back!`
    };

    if (attachmentStreams?.length) {                             formMessage.attachment =
        attachmentStreams;
    }


    /*
     * ========================================================
     * SEND
     * ========================================================
     */

    try {
      const info = await new Promise(
        (resolve, reject) => {
          api.sendMessage(
            formMessage,
            targetTID,
            (err, sentInfo) => {
              if (err) {
                return reject(err);
              }

              resolve(sentInfo);
            }
          );
        }
      );

      if (!info?.messageID) {
        throw new Error(                                             "Facebook did not return messageID"
        );                                                       }

                                                                 /*
       * Register reply handler.
       */

      global.GoatBot.onReply.set(
        info.messageID,
        {
          commandName,
          targetMessageID:
            info.messageID,

          backToTID:
            String(threadID),

          backToMID:
            messageID
        }
      );


      return api.sendMessage(                                      "✅ Message sent successfully!",
        threadID,                                                  messageID
      );
    } catch (error) {                                            console.error(
        "[RCHAT SEND ERROR]",
        error
      );

      return api.sendMessage(
        "❌ Failed to send the message.\n" +
        "The target group may be inactive or inaccessible.",
        threadID,
        messageID                                                );
    }
  },


  /*
   * ==========================================================
   * ON REPLY
   * ==========================================================
   */

  onReply: async function ({
    api,
    event,
    Reply,
    usersData,
    commandName
  }) {
    const {
      threadID,
      messageID,
      senderID,
      body,
      attachments = []
    } = event;

    let senderName = "Unknown User";

    try {                                                        senderName =
        await usersData.getName(senderID);
    } catch {
      // fallback
    }


    /*
     * Determine destination.
     *
     * If reply comes from target group:
     * send back to original group.
     *
     * Otherwise:
     * continue the existing route.
     */

    let sendToTID;                                             let replyToMID;

    if (
      String(threadID) ===
      String(Reply.backToTID)
    ) {
      /*
       * Original group replied.
       * Send to the target message's thread.
       */

      sendToTID =
        event.messageReply?.threadID ||
        Reply.targetThreadID ||
        Reply.backToTID;

      replyToMID =
        Reply.targetMessageID;
    } else {
      /*
       * Target group replied.
       * Send back to original group.
       */

      sendToTID =
        Reply.backToTID;

      replyToMID =
        Reply.backToMID;
    }


    /*
     * Attachments.
     */

    const validAttachments =
      attachments.filter(item =>
        item &&
        mediaTypes.includes(item.type)
      );


    let attachmentStreams = [];
                                                               try {
      if (validAttachments.length) {                               attachmentStreams =
          await getStreamsFromAttachment(                              validAttachments
          );                                                     }
    } catch (error) {                                            console.error(
        "[RCHAT REPLY ATTACHMENT ERROR]",                          error
      );                                                       }                                                      
                                                               /*                                                          * Build reply.
     */                                                    
    const formMessage = {                                        body:
        `📩 Rchat Reply from ${senderName}\n` +                    `━━━━━━━━━━━━━━━━━━\n` +
        `${body || "Sent an attachment"}\n` +                      `━━━━━━━━━━━━━━━━━━\n` +                                   `↩️ Reply to continue`
    };                                                                                                                    if (attachmentStreams?.length) {
      formMessage.attachment =                                     attachmentStreams;                                     }
                                                                                                                          /*
     * Send reply.                                              */                                                    
    try {                                                        const info = await new Promise(                              (resolve, reject) => {
          api.sendMessage(                                             formMessage,                                               sendToTID,
            (err, sentInfo) => {                                         if (err) {
                return reject(err);                                      }
                                                                         resolve(sentInfo);
            },                                                         replyToMID
          );                                                       }
      );                                                   
                                                                 if (info?.messageID) {                                       global.GoatBot.onReply.set(                                  info.messageID,
          {                                                            commandName,                                                                                                          targetMessageID:                                             info.messageID,
                                                                       backToTID:                                                   String(threadID),                            
            backToMID:                                                   messageID                                              }                                                        );
      }                                                                                                               
      api.setMessageReaction(                                      "✅",                                                      messageID,
        threadID,                                                  () => {},                                                  true
      );                                                       } catch (error) {                                            console.error(
        "[RCHAT REPLY ERROR]",                                     error                                                    );                                                   
      api.setMessageReaction(                                      "❌",                                                      messageID,                                                 threadID,
        () => {},                                                  true                                                     );                                                       }
  }                                                        };