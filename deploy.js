const axios = require("axios");
const { loadOwner } = require("../../rakib/customId/ownerUid");

async function isOwner(uid) {
  const owner = await loadOwner();

  if (!owner) return false;

  return Array.isArray(owner)
    ? owner.map(String).includes(String(uid))
    : String(owner) === String(uid);
}

module.exports = {
  config: {
    name: "deploy",
    aliases: ["renderdeploy", "redeploy"],
    version: "1.0",
    author: "Rakib",
    role: 2,
    shortDescription: {
      en: "Deploy latest commit on Render"
    },
    longDescription: {
      en: "Trigger Render Deploy Hook"
    },
    category: "owner",
    guide: {
      en: "{pn}"
    }
  },

  onStart: async function ({ message, event }) {
    const senderID = event.senderID;

    if (!(await isOwner(senderID))) {
      return message.reply("❌ Only bot owner can use this command.");
    }

    const DEPLOY_HOOK_URL = "https://api.render.com/deploy/srv-d7uae23tqb8s73a0sh90?key=rZeS4phUYWs";

    try {
      await message.reply("🚀 Starting Render deployment...");

      await axios.post(DEPLOY_HOOK_URL);

      return message.reply(
        "✅ Deploy request sent successfully.\n\n⏳ Render is now building and deploying the latest commit from GitHub."
      );

    } catch (err) {
      return message.reply(
        `❌ Deploy Failed\n\n${err.message}`
      );
    }
  }
};
