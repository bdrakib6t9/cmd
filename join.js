const axios = require("axios");
const fs = require("fs-extra");                            const request = require("request");
const isAdultText = require("../../bot/handler/adultfilter.js");
                                                           module.exports = {                                           config: {
    name: "join",                                              version: "1.0",                                            author: "Rakib",
    countDown: 5,                                              role: 2,                                                   shortDescription: "Join/add user to a group",
    longDescription: "Show bot groups and join/add using group TID",                                                      category: "user",
    guide: {                                                     en: "{p}{n} - Show group list\n{p}{n} <TID> - Join using TID"
    }                                                        },                                                       
  onStart: async function ({ api, event, args, message, threadsData }) {                                                  try {
      /*                                                          * ==========================================
       * DIRECT TID MODE                                          * join <TID>                                               * ==========================================
       */                                                                                                                   if (args && args.length > 0) {
        const input = args.join(" ").trim();
                                                                   // TID normally consists of numbers
        const threadID = input.replace(/\D/g, "");         
        if (!threadID) {                                             return message.reply(
            "❌ | Invalid Thread ID.\n\nExample:\njoin 1234567890123456"
          );                                                       }
                                                                   return await joinByThreadID({
          api,                                                       event,
          message,                                                   threadID                                                 });
      }                                                    
      /*                                                          * ==========================================
       * SHOW GROUP LIST                                          * ==========================================
       */                                                  
      /*                                                          * ==========================================
       * GET GROUP LIST FROM BOT DATABASE                         * ==========================================
       *                                                          * DO NOT use api.getThreadList().
       * FCA getThreadList is intentionally disabled              * in this bot because it loads hundreds of groups.
       *                                                          * threadsData.getAll() reads the existing bot DB.
       */                                                  
      let groupList;
                                                                 try {                                                        if (
          !threadsData ||                                            typeof threadsData.getAll !== "function"                 ) {
          return message.reply(                                        "❌ | threadsData.getAll() is not available."            );                                                       }
                                                                   groupList = await threadsData.getAll();                                                                               console.log(                                                 `[JOIN] Loaded ${Array.isArray(groupList) ? groupList.length : 0} threads from database.`                           );                                                                                                                  } catch (error) {
        console.error(                                               "[JOIN] threadsData.getAll() failed:",                     error                                                    );
                                                                   const errorText =                                            error?.message ||
          (typeof error === "string" ? error : null) ||
          (() => {                                                     try {
              return JSON.stringify(error, null, 2);
            } catch {
              return String(error);
            }                                                        })();
                                                                   return message.reply(
`❌ | Failed to get group list from database.                                                                         Reason:
${errorText}`                                                      );                                                       }
                                                                 if (!Array.isArray(groupList) || groupList.length === 0) {
        return message.reply(                                        "❌ | No group chats found."                             );                                                       }
                                                                 /*                                                          * Get only group conversations
       */                                                        const filteredList = groupList.filter(group => {             if (!group || !group.threadID) {                             return false;
        }                                                                                                                     /*
         * Only actual group threads.                               * Do not include user/private chats.
         */                                                        return (
          group.isGroup === true ||
          Array.isArray(group.members)                             );
      });                                                                                                                   if (filteredList.length === 0) {
        return message.reply(                                        "❌ | No group chats found."
        );                                                       }                                                    
      let msg =                                            `╭────『 GROUP LIST 』────╮
│ 🤖 TESSA BOT                                             │ 📦 Total: ${filteredList.length}                         ╰──────────────────────╯                                   
`;                                                                                                                          const validGroups = [];                              
      filteredList.forEach((group, index) => {                     const threadID =                                             group.threadID ||                                          group.threadKey ||
          group.thread_id;                                                                                                    if (!threadID) return;                                                                                                /*
         * New FCA may use different name fields.                   */                                                        let groupName =                                              group.threadName ||                                        group.name ||
          group.thread_name ||                                       group.title ||                                             group.chatName;                                  
        /*                                                          * Mask blocked words in group names only for               * the JOIN list. Original DB value is untouched.           */
        if (groupName) {                                             const detectedWords =
            typeof isAdultText.getDetectedWords === "function"                                                                      ? isAdultText.getDetectedWords(String(groupName))
              : [];                                        
          for (const word of detectedWords) {                          if (!word) continue;

            const escaped = String(word).replace(                        /[.*+?^${}()|[\]\\]/g,
              "\\$&"                                                   );
                                                                       try {
              groupName = String(groupName).replace(
                new RegExp(escaped, "giu"),                                match => {
                  if (match.length <= 1)                                       return "*";
                                                                             return (
                    match.charAt(0) +                                          "*".repeat(match.length - 1)
                  );                                                       }
              );                                                       } catch (error) {
              console.log(                                                 "[JOIN] Failed to mask blocked word:",
                word,
                error.message
              );                                                       }
          }
        }                                                  
        /*                                                          * Sometimes name can be empty.
         */                                                        if (
          !groupName ||                                              String(groupName).trim() === ""
        ) {                                                          groupName = "Unnamed Group";
        }                                                                                                                     validGroups.push({
          threadID: String(threadID),                                threadName: String(groupName)                            });
                                                                   msg +=
`╭─〔 ${index + 1} 〕────────                              │ 📌 ${groupName}
│ 🆔 ${threadID}                                           ╰────────────────
                                                           `;
      });                                                  
      msg +=                                               `💬 Reply:                                                 • Number → Select group
• join <TID> → Direct join                                                                                            Example:
join 1234567890123456`;                                                                                                     const sentMessage = await message.reply(msg);
                                                                 /*
       * Save reply data                                          */
      global.GoatBot.onReply.set(sentMessage.messageID, {
        commandName: "join",
        messageID: sentMessage.messageID,                          threadID: event.threadID,
        author: event.senderID,                                    groups: validGroups
      });
                                                               } catch (error) {
      console.error(                                               "[JOIN] Error listing groups:",
        error                                                    );
                                                                 const errorText =
        error?.message ||                                          (typeof error === "string" ? error : null) ||
        (() => {
          try {
            return JSON.stringify(error, null, 2);                   } catch {
            return String(error);                                    }
        })();                                              
      return message.reply(                                `❌ | Failed to get group list.
                                                           Reason:                                                    ${errorText}`
      );                                                       }                                                        },
                                                             onReply: async function ({
    api,                                                       event,                                                     Reply,
    args,                                                      message                                                  }) {
    try {                                                        /*
       * Only command owner can use reply                         */                                                        if (
        String(event.senderID) !==                                 String(Reply.author)                                     ) {
        return;                                                  }                                                    
      /*                                                          * ==========================================
       * GET USER INPUT                                           * ==========================================
       *                                                          * Supports:                                                * 1
       * join 123456789                                           * 123456789
       */                                                  
      const body = String(event.body || "").trim();        
      let input = body;                                    
      if (                                                         input.toLowerCase().startsWith("join ")                  ) {                                                          input = input.slice(5).trim();
      }                                                                                                                     /*                                                          * ==========================================               * DIRECT TID
       * ==========================================               */                                                                                                                   if (/^\d{10,}$/.test(input)) {
        return await joinByThreadID({                                api,
          event,                                                     message,                                                   threadID: input,
          oldMessageID: Reply.messageID                            });
      }                                                                                                                     /*
       * ==========================================               * NUMBER SELECTION
       * ==========================================               */                                                                                                                   const groupIndex = parseInt(input, 10);
                                                                 if (                                                         Number.isNaN(groupIndex) ||                                groupIndex <= 0
      ) {                                                          return message.reply(                              `⚠️ | Invalid input.                                                                                                   Reply with:
1-${Reply.groups?.length || "available groups"}                                                                       Or:                                                        join <TID>`                                                        );
      }                                                                                                                     if (                                                         !Array.isArray(Reply.groups) ||
        groupIndex > Reply.groups.length                         ) {
        return message.reply(                                        "❌ | Invalid group number."
        );                                                       }
                                                                 const selectedGroup =
        Reply.groups[groupIndex - 1];                      
      if (!selectedGroup) {                                        return message.reply(                                        "❌ | Group not found."
        );                                                       }
                                                                 /*
       * Join selected group                                      */
      return await joinByThreadID({                                api,
        event,                                                     message,
        threadID: selectedGroup.threadID,                          groupName: selectedGroup.threadName,
        oldMessageID: Reply.messageID                            });
                                                               } catch (error) {
      console.error(                                               "[JOIN REPLY] Error:",                                     error                                                    );
                                                                 return message.reply(
`❌ | An error occurred.                                   
${error.message}`                                                );
    }                                                        }
};                                                         
                                                           /*
 * ==================================================       * JOIN BY THREAD ID
 * ==================================================       */
                                                           async function joinByThreadID({
  api,                                                       event,
  message,                                                   threadID,
  groupName,                                                 oldMessageID
}) {                                                         try {
    threadID = String(threadID).trim();                    
    if (!threadID) {                                             return message.reply(
        "❌ | Thread ID is required."                            );
    }                                                      
    /*                                                          * Delete previous JOIN list message
     */                                                        if (oldMessageID) {
      try {                                                        await message.unsend(oldMessageID, event.threadID);
      } catch (error) {                                            console.log(
          "[JOIN] Failed to delete old message:",                    error.message                                            );
      }                                                        }
                                                               /*                                                          * Get bot's own UID
     */                                                        let botID;
                                                               try {
      if (typeof api.getCurrentUserID === "function") {            botID = await api.getCurrentUserID();
      }                                                        } catch (error) {
      console.log(                                                 "[JOIN] getCurrentUserID failed:",
        error.message                                            );
    }                                                      
    /*                                                          * Some FCA versions expose bot UID differently.
     */                                                        if (!botID) {
      botID =                                                      api.getCurrentUserID?.() ||
        api.currentUserID ||                                       api.userID ||
        api.getCurrentUserID;                                  }
                                                               if (!botID) {
      return message.reply(                                `❌ | Bot UID could not be detected.                       
Please check your FCA's currentUserID implementation.`           );                                                       }
                                                               /*
     * Try to get group information.                            *                                                          * This also helps determine whether
     * the bot already has access to the TID.                   */
    let threadInfo = null;                                                                                                try {
      if (typeof api.getThreadInfo === "function") {               threadInfo =
          await api.getThreadInfo(threadID);                     }
    } catch (error) {                                            console.log(
        "[JOIN] getThreadInfo:",                                   error.message
      );                                                       }
                                                               if (!groupName) {                                            groupName =                                                  threadInfo?.threadName ||
        threadInfo?.name ||                                        threadInfo?.title ||
        "Unknown Group";                                       }                                                      
    /*                                                          * ==========================================               * ADD BOT TO GROUP
     * ==========================================
     *                                                          * IMPORTANT:
     * This only works if the FCA/Facebook session              * is allowed to add the bot account to that                * thread.
     */                                                                                                                   try {
      await api.addUserToGroup(                                    String(botID),                                             String(threadID)
      );                                                                                                                  } catch (joinError) {                                        console.error(
        "[JOIN] addUserToGroup failed:",                           joinError                                                );
                                                                 return message.reply(                                `❌ | Failed to join/add bot to the group.                 
📌 Group: ${groupName}                                     🆔 TID: ${threadID}                                                                                                   Reason:
${joinError.message}                                                                                                  ⚠️ The bot account must have permission/access to be added to this group.`                                                   );                                                       }
                                                               /*
     * Success                                                  */
    return message.reply(                                  `╭──『 JOIN SUCCESS 』──╮                                  │ ✅ Bot joined/added
│                                                          │ 📌 Group: ${groupName}
│ 🆔 TID: ${threadID}                                      ╰────────────────────╯`                                        );
                                                             } catch (error) {
    console.error(                                               "[JOIN] Final error:",
      error                                                    );
                                                               return message.reply(                                  `❌ | Join failed.                                         
${error.message}`                                              );                                                       }                                                        }