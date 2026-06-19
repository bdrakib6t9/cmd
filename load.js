const { loadOwner } = require("../../rakib/customId/ownerUid");

module.exports = {
  config: {
    name: "load",
    aliases: ["ldc", "loadcmd"],
    version: "1.1",
    author: "Rakib",
    role: 0,
    shortDescription: "load command from url or direct code",
    longDescription: "deploy js code from public raw links or direct text reply (owner only)",
    category: "Bot account",
    guide: {
      en: "Reply a raw code link or direct code text and type: load <commandName>"
    }
  },

  onStart: async function ({ api, event, args }) {
    const ownerUID = await loadOwner();

    const isOwner = Array.isArray(ownerUID)
      ? ownerUID.includes(String(event.senderID))
      : String(event.senderID) === String(ownerUID);

    if (!isOwner) {
      return api.sendMessage(
        "❌ | You aren't allowed to use this command.",
        event.threadID,
        event.messageID
      );
    }

    const axios = require("axios");
    const fs = require("fs");
    const path = require("path");

    const { messageReply, threadID, messageID } = event;
    const name = args[0];

    if (!messageReply || !name) {
      return api.sendMessage(
        "❌ Reply to a URL/Code and use: load <commandName>",
        threadID,
        messageID
      );
    }

    let content = (messageReply.body || "").trim();
    let code = "";

    // চেক করা হচ্ছে রিপ্লাইয়ের টেক্সটটি কোনো লিংক কিনা
    if (/^https?:\/\//i.test(content)) {
      let url = content;

      try {
        // Google Docs
        if (url.includes("docs.google.com/document")) {
          const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
          if (!match) {
            return api.sendMessage(
              "❌ Cannot extract Google Docs ID.",
              threadID,
              messageID
            );
          }
          url = `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
        }

        // GitHub file link -> Raw
        if (url.includes("github.com") && url.includes("/blob/")) {
          url = url
            .replace("github.com", "raw.githubusercontent.com")
            .replace("/blob/", "/");
        }

        // Pastebin
        if (url.includes("pastebin.com/") && !url.includes("/raw/")) {
          const id = url.split("/").pop();
          url = `https://pastebin.com/raw/${id}`;
        }

        // Rentry
        if (url.includes("rentry.co/") && !url.endsWith("/raw")) {
          url = url.replace(/\/$/, "") + "/raw";
        }

        const res = await axios.get(url, {
          responseType: "text",
          timeout: 20000,
          maxRedirects: 5
        });

        code = String(res.data || "");

      } catch (err) {
        console.error("LOAD ERROR (URL FETCH):", err);
        return api.sendMessage(
          "❌ Failed to fetch file.\nMake sure the link is public and accessible.",
          threadID,
          messageID
        );
      }
    } else {
      // যদি লিংক না হয়, তাহলে রিপ্লাইয়ের টেক্সটটাকেই সরাসরি কোড হিসেবে ধরে নেওয়া হবে
      code = content;
    }

    // কোড ভ্যালিডেশন
    if (code.length < 10) {
      return api.sendMessage(
        "❌ Empty or invalid file content.",
        threadID,
        messageID
      );
    }

    if (!code.includes("module.exports") && !code.includes("exports.")) {
      return api.sendMessage(
        "❌ This doesn't appear to be a valid command file.",
        threadID,
        messageID
      );
    }

    try {
      const savePath = path.join(__dirname, `${name}.js`);
      fs.writeFileSync(savePath, code, "utf8");

      return api.sendMessage(
        `✅ Command "${name}.js" added successfully!\n👉 Use: loadcmd ${name}`,
        threadID,
        messageID
      );
    } catch (err) {
      console.error("LOAD ERROR (WRITE FILE):", err);
      return api.sendMessage(
        "❌ Failed to save the command file locally.",
        threadID,
        messageID
      );
    }
  }
};
