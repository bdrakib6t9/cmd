const activePolls = new Map();

module.exports = {
	config: {
		name: "poll",
		aliases: ["poll"],
		version: "1.0",
		author: "Rakib",
		countDown: 5,
		role: 0,
		shortDescription: "Create poll",
		longDescription: "Create vote poll",
		category: "group"
	},

	onStart: async function ({ message, event, args }) {
		const question = args.join(" ");

		if (!question)
			return message.reply("⚠️ | একটি প্রশ্ন দিন।");

		const msg = await message.reply(
			`📊 POLL STARTED\n\n❓ ${question}\n\n✅ Reply: yes\n❌ Reply: no\n\n⏳ Poll ends in 60 seconds.`
		);

		activePolls.set(msg.messageID, {
			question,
			yes: [],
			no: [],
			threadID: event.threadID
		});

		setTimeout(async () => {
			const poll = activePolls.get(msg.messageID);
			if (!poll) return;

			activePolls.delete(msg.messageID);

			await message.reply(
				`📊 POLL RESULT\n\n❓ ${poll.question}\n\n✅ Yes: ${poll.yes.length}\n❌ No: ${poll.no.length}\n\n🏆 Winner: ${
					poll.yes.length > poll.no.length
						? "YES"
						: poll.no.length > poll.yes.length
						? "NO"
						: "DRAW"
				}`
			);
		}, 60000);
	},

	onChat: async function ({ event }) {
		if (!event.messageReply) return;

		const poll = activePolls.get(event.messageReply.messageID);
		if (!poll) return;

		const vote = event.body?.toLowerCase();

		if (vote !== "yes" && vote !== "no") return;

		poll.yes = poll.yes.filter(uid => uid !== event.senderID);
		poll.no = poll.no.filter(uid => uid !== event.senderID);

		if (vote === "yes")
			poll.yes.push(event.senderID);
		else
			poll.no.push(event.senderID);
	}
};
