const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  config: {
    name: "pnduser",
    version: "1.0",
    author: "Rakib",
    countDown: 5,
    role: 1,
    description: {
      en: "View approval queue or approve all members automatically"
    },
    category: "box chat",
    guide: {
      en: "   {pn} - পেন্ডিং লিস্ট দেখতে\n   {pn} addall - সবাইকে অটোমেটিক অ্যাড করতে"
    }
  },

  onStart: async function ({ message, api, event, args }) {
    try {
      const info = await api.getThreadInfo(event.threadID);
      const queue = info.approvalQueue || [];
      
      if (queue.length === 0) {
        return message.reply("❌ বর্তমানে গ্রুপের পেন্ডিং লিস্টে (Approval Queue) কোনো মেম্বার নেই।");
      }

      if (args.length === 0) {
        let msg = `== [ পেন্ডিং মেম্বার লিস্ট ] ==\nTotal: ${queue.length} জন\n━━━━━━━━━━━━━━━━━━\n`;
        queue.forEach((user, index) => {
          msg += `${index + 1}. নাম: ${user.name || "Facebook User"}\n   UID: ${user.requesterID}\n━━━━━━━━━━━━━━━━━━\n`;
        });
        return message.reply(msg.slice(0, 4000));
      }

      if (args[0].toLowerCase() === "addall") {
        message.reply(`🔄 পেন্ডিং লিস্টে থাকা ${queue.length} জনকে একে একে অ্যাড করা শুরু হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন।`);

        let successCount = 0;
        let failCount = 0;

        for (const user of queue) {
          const uid = user.requesterID;
          try {
            await api.addUserToGroup(uid, event.threadID);
            successCount++;
          } catch (err) {
            failCount++;
          }
          
          await sleep(1000); 
        }

        return message.reply(`✅ প্রসেস সম্পন্ন হয়েছে!\n🎉 সফলভাবে অ্যাড হয়েছে: ${successCount} জন\n❌ ব্যর্থ হয়েছে: ${failCount} জন`);
      }

      // ভুল কমান্ড দিলে গাইড দেখাবে
      return message.reply("❌ ভুল কমান্ড! শুধু লিস্ট দেখতে লিখুন: pnduser\nসবাইকে একসাথে অ্যাড করতে লিখুন: pnduser addall");

    } catch (e) {
      return message.reply("⚠️ ত্রুটি ঘটেছে: " + e.message);
    }
  }
};
