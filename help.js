const { getPrefix } = global.utils;
const { commands, aliases } = global.GoatBot;

module.exports = {
  config: {
    name: "help",
    version: "2.0.0",
    author: "Ktkhang | modified HOON",
    countDown: 5,
    role: 0,
    shortDescription: { en: "View command list with beautiful pages" },
    longDescription: { en: "View command list with beautiful pages and interactive reply system" },
    category: "info",
    guide: { en: "help [page/command]" },
    priority: 1,
  },

  onStart: async function ({ message, args, event, threadsData, role }) {
    const { threadID } = event;
    const prefix = getPrefix(threadID);

    // ১. নির্দিষ্ট কমান্ডের হেল্প দেখতে চাইলে
    if (args.length > 0 && isNaN(args[0])) {
      const commandName = args[0].toLowerCase();
      const command = commands.get(commandName) || commands.get(aliases.get(commandName));

      if (!command) return message.reply(`✕ | Command "${commandName}" not found.`);

      const configCommand = command.config;
      const roleText = roleTextToString(configCommand.role);
      const longDescription = configCommand.longDescription?.en || "No description";
      const guideBody = configCommand.guide?.en || "No guide available.";
      const usage = guideBody.replace(/{p}/g, prefix).replace(/{n}/g, configCommand.name);

      const response = 
        `╭─────────────────────⭓\n` +
        `│ ✦ 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗗𝗘𝗧𝗔𝗜𝗟𝗦 ✦\n` +
        `├─────────────────────⭗\n` +
        `│ 📁 𝐍𝐚𝐦𝐞: ${configCommand.name}\n` +
        `│ 🏷️ 𝐀𝐥𝐢𝐚𝐬𝐞𝐬: ${configCommand.aliases ? configCommand.aliases.join(", ") : "None"}\n` +
        `│ 📝 𝐃𝐞𝐬𝐜𝐫𝐢𝐩𝐭𝐢𝐨𝐧: ${longDescription}\n` +
        `│ 📘 𝐆𝐮𝐢𝐝𝐞: ${usage}\n` +
        `│ 🛡️ 𝐏𝐞𝐫𝐦𝐢𝐬𝐬𝐢𝐨𝐧: ${roleText}\n` +
        `│ ⏳ 𝐂𝐨𝐨𝐥𝐝𝐨𝐰𝐧: ${configCommand.countDown || 0}s\n` +
        `╰─────────────────────⭓`;

      return message.reply(response);
    }

    // ২. পেজ সিস্টেম জেনারেট করা
    const pageInput = args[0] ? parseInt(args[0]) : 1;
    const { msg, totalPage, currentPage } = generateHelpMenu(prefix, role, pageInput);

    const helpMsg = await message.reply(msg);

    // Reply tracking এর জন্য ডেটা সেভ রাখা
    global.GoatBot.onReply.set(helpMsg.messageID, {
      commandName: this.config.name,
      messageID: helpMsg.messageID,
      role: role
    });

    // ৮০ সেকেন্ড পর মেসেজ আনসেন্ড করার জন্য
    setTimeout(() => {
      message.unsend(helpMsg.messageID);
    }, 80000);
  },

  // রিপ্লাই দিয়ে পেজ চেঞ্জ করার হ্যান্ডলার
  onReply: async function ({ message, event, Reply, role }) {
    const { body, threadID } = event;
    const prefix = getPrefix(threadID);

    if (!body || isNaN(body)) return;
    const pageInput = parseInt(body);

    // আগের হেল্প মেসেজটি আনসেন্ড করে দেওয়া (ক্লিন চ্যাটের জন্য)
    message.unsend(Reply.messageID);

    const { msg, totalPage, currentPage } = generateHelpMenu(prefix, Reply.role, pageInput);
    const helpMsg = await message.reply(msg);

    // নতুন মেসেজ আইডি আবার ট্র্যাকিং এ রাখা
    global.GoatBot.onReply.set(helpMsg.messageID, {
      commandName: this.config.name,
      messageID: helpMsg.messageID,
      role: Reply.role
    });
  }
};

// ক্যাটাগরি ভিত্তিক ইউনিক ডিজাইন জেনারেট করার ফাংশন
function generateHelpMenu(prefix, role, pageInput) {
  const categories = {};
  
  // সমস্ত ভ্যালিড কমান্ড ক্যাটাগরি অনুযায়ী সাজানো
  for (const [name, value] of commands) {
    if (value.config.role > 1 && role < value.config.role) continue;
    const category = value.config.category || "Uncategorized";
    if (!categories[category]) categories[category] = [];
    categories[category].push(name);
  }

  const categoryKeys = Object.keys(categories).sort();
  const itemsPerPage = 3; // প্রতি পেজে ৩টি করে ক্যাটাগরি দেখাবে
  const totalPage = Math.ceil(categoryKeys.length / itemsPerPage);
  
  let currentPage = pageInput;
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPage) currentPage = totalPage;

  let msg = `╭─────────────────────⭓\n│  🌐 𝗧𝗘𝗦𝗦𝗔 𝗦𝗬𝗦𝗧𝗘𝗠 𝗛𝗘𝗟𝗣  \n╰─────────────────────⭓\n`;

  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const pageCategories = categoryKeys.slice(startIdx, endIdx);

  // ইউনিক ক্যাটাগরি ও কমান্ড ডিজাইন
  pageCategories.forEach((category) => {
    msg += `\n❯ 🌟 ${category.toUpperCase()} 🌟\n`;
    const sortedCmds = categories[category].sort();
    
    // কমান্ডগুলোকে ৩টি কলামে সুন্দরভাবে সাজানো
    let cmdRows = "";
    for (let i = 0; i < sortedCmds.length; i += 3) {
      const chunk = sortedCmds.slice(i, i + 3).map(cmd => `• ${cmd}`);
      cmdRows += `  ${chunk.join("      ")}\n`;
    }
    msg += cmdRows;
  });

  msg += `\n╭─────────────────────⭓\n`;
  msg += `│ 📊 Total Commands: ${commands.size}\n`;
  msg += `│ 📄 Page: [ ${currentPage} / ${totalPage} ]\n`;
  msg += `│ 💡 Tip: Reply with [Page Number]\n`;
  msg += `│ 🔍 Use: ${prefix}help <cmd_name>\n`;
  msg += `├─────────────────────⭗\n`;
  msg += `│ 👑 Admin: TESSA\n`;
  msg += `│ 🌐 fb.com/profile.php?id=61574231934756\n`;
  msg += `╰─────────────────────⭓`;

  return { msg, totalPage, currentPage };
}

function roleTextToString(roleText) {
  switch (roleText) {
    case 0: return "All Users";
    case 1: return "Group Admins";
    case 2: return "Bot Admin";
    default: return "Unknown";
  }
}
