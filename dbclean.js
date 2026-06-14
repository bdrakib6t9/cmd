const { loadOwner } = require("../../rakib/customId/ownerUid");

async function isOwner(senderID) {
const owner = await loadOwner();

if (!owner) return false;

return Array.isArray(owner)
	? owner.map(String).includes(String(senderID))
	: String(owner) === String(senderID);

}

module.exports = {
config: {
name: "dbclean",
version: "1.0",
author: "Rakib",
countDown: 10,
role: 0,

	description: {
		en: "Clean inactive members from thread database"
	},

	category: "system",

	guide: {
		en: "{pn}"
	}
},

onStart: async function ({
	event,
	message,
	threadsData
}) {

	try {

		if (!(await isOwner(event.senderID))) {
			return message.reply(
				"❌ | Only bot owner can use this command"
			);
		}

		const threadID = event.threadID;

		const threadData = await threadsData.get(threadID);

		if (!threadData?.members) {
			return message.reply(
				"❌ | Members data not found"
			);
		}

		const oldMembers = threadData.members;

		const activeMembers = oldMembers.filter(
			user => (user.count || 0) > 1
		);

		const removedCount =
			oldMembers.length - activeMembers.length;

		await threadsData.set(
			threadID,
			activeMembers,
			"members"
		);

		return message.reply(
			`🧹 DATABASE CLEAN COMPLETE\n\n` +
			`👥 Total Members: ${oldMembers.length}\n` +
			`✅ Active Kept: ${activeMembers.length}\n` +
			`🗑 Removed: ${removedCount}\n\n` +
			`Only members with count > 1 were kept.`
		);

	}
	catch (err) {
		console.error(err);

		return message.reply(
			"❌ | Clean failed\n\n" +
			err.message
		);
	}
}

};
