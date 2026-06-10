const { loadOwner } = require("../../rakib/customId/ownerUid");

module.exports = {
  config: {
    name: "load",
    aliases: ["pdc", "cmdload"],
    version: "2.0",
    author: "Rakib",
    role: 0,
    shortDescription: "load command from url",
    longDescription: "deploy js code from public raw links (owner only)",
    category: "Bot account",
    guide: {
      en: "Reply a raw code link and type: load <commandName>"
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
        "❌ Reply to a URL and use: load <commandName>",
        threadID,
        messageID
      );
    }

    let url = (messageReply.body || "").trim();

    if (!/^https?:\/\//i.test(url)) {
      return api.sendMessage(
        "❌ Invalid URL.",
        threadID,
        messageID
      );
    }

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
      if (
        url.includes("github.com") &&
        url.includes("/blob/")
      ) {
        url = url
          .replace("github.com", "raw.githubusercontent.com")
          .replace("/blob/", "/");
      }

      // Pastebin
      if (
        url.includes("pastebin.com/") &&
        !url.includes("/raw/")
      ) {
        const id = url.split("/").pop();
        url = `https://pastebin.com/raw/${id}`;
      }

      // Rentry
      if (
        url.includes("rentry.co/") &&
        !url.endsWith("/raw")
      ) {
        url = url.replace(/\/$/, "") + "/raw";
      }

      const res = await axios.get(url, {
        responseType: "text",
        timeout: 20000,
        maxRedirects: 5
      });

      const code = String(res.data || "");

      if (code.length < 10) {
        return api.sendMessage(
          "❌ Empty or invalid file content.",
          threadID,
          messageID
        );
      }

      if (
        !code.includes("module.exports") &&
        !code.includes("exports.")
      ) {
        return api.sendMessage(
          "❌ This doesn't appear to be a valid command file.",
          threadID,
          messageID
        );
      }

      const savePath = path.join(__dirname, `${name}.js`);

      fs.writeFileSync(savePath, code, "utf8");

      return api.sendMessage(
        `✅ Command "${name}.js" added successfully!\n👉 Use: loadcmd ${name}`,
        threadID,
        messageID
      );

    } catch (err) {
      console.error("LOAD ERROR:", err);

      return api.sendMessage(
        "❌ Failed to fetch file.\nMake sure the link is public and accessible.",
        threadID,
        messageID
      );
    }
  }
};
