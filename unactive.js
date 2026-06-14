const { getTime } = global.utils;

module.exports = {
config: {
name: "unactive",
aliases: ["inactive", "clean"],
version: "1.0",
author: "Rakib",
countDown: 5,
role: 1,
shortDescription: {
en: "Kick inactive members"
},
longDescription: {
en: "Remove members who never sent any message"
},
category: "group",
guide: {
en: "{pn}"
}
},

onStart: async function ({ api, event, threadsData, message }) {
	const { threadID } = event;

	try {
		const threadInfo = await api.getThreadInfo(threadID);
		const botID = api.getCurrentUserID();

		const botAdmin = threadInfo.adminIDs.some(
			item => item.id == botID
		);

		if (!botAdmin)
			return message.reply("❌ Bot must be admin to remove members.");

		const threadData = await threadsData.get(threadID);
		const members = threadData.members || [];

		const inactiveMembers = members.filter(
			user =>
				threadInfo.participantIDs.includes(user.userID) &&
				(!user.count || user.count <= 1)
		);

		if (inactiveMembers.length === 0)
			return message.reply("✅ No inactive members found.");

		let success = 0;
		let failed = 0;
		let list = "";

		for (const user of inactiveMembers) {
			try {
				await api.removeUserFromGroup(user.userID, threadID);
				success++;
				list += `✅ ${user.name}\n`;

				await new Promise(resolve => setTimeout(resolve, 1000));
			}
			catch (e) {
				failed++;
			}
		}

		return message.reply(
			`🧹 INACTIVE CLEANUP\n\n` +
			`👥 Found: ${inactiveMembers.length}\n` +
			`✅ Removed: ${success}\n` +
			`❌ Failed: ${failed}\n\n` +
			list
		);
	}
	catch (err) {
		console.log(err);
		return message.reply("❌ Error: " + err.message);
	}
}

};
