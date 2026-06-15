const polls = new Map();

module.exports = {
	config: {
		name: "poll",
		version: "2.0",
		author: "Rakib",
		countDown: 5,
		role: 0,
		shortDescription: "Create poll",
		longDescription: "Advanced voting system",
		category: "group"
	},

	onStart: async function ({ message, args }) {
		const input = args.join(" ");

		if (!input.includes("|"))
			return message.reply(
				"📌 Format:\n/poll Question | Option 1 | Option 2 | Option 3"
			);

		const parts = input.split("|").map(x => x.trim());

		if (parts.length < 3)
			return message.reply("⚠️ Minimum 2 options required.");

		const question = parts[0];
		const options = parts.slice(1);

		let text = `📊 POLL STARTED\n\n❓ ${question}\n\n`;

		options.forEach((opt, i) => {
			text += `${i + 1}️⃣ ${opt}\n`;
		});

		text += `\n🗳️ Reply with option number\n⏳ Ends in 5 minutes`;

		const msg = await message.reply(text);

		polls.set(msg.messageID, {
			question,
			options,
			votes: {},
			creator: msg.senderID
		});

		global.GoatBot.onReply.set(msg.messageID, {
			commandName: this.config.name,
			messageID: msg.messageID
		});

		setTimeout(async () => {
			const poll = polls.get(msg.messageID);
			if (!poll) return;

			const count = Array(options.length).fill(0);

			for (const uid in poll.votes) {
				count[poll.votes[uid]]++;
			}

			let result = `📊 POLL RESULT\n\n❓ ${poll.question}\n\n`;

			options.forEach((opt, i) => {
				result += `${i + 1}️⃣ ${opt}: ${count[i]} vote(s)\n`;
			});

			const winner = Math.max(...count);
			const winnerIndex = count.indexOf(winner);

			if (winner > 0)
				result += `\n🏆 Winner: ${options[winnerIndex]}`;

			result += `\n👥 Total Votes: ${Object.keys(poll.votes).length}`;

			await message.reply(result);

			polls.delete(msg.messageID);
			global.GoatBot.onReply.delete(msg.messageID);
		}, 300000);
	},

	onReply: async function ({ event, message, Reply }) {
		const poll = polls.get(Reply.messageID);
		if (!poll) return;

		const choice = parseInt(event.body);

		if (
			isNaN(choice) ||
			choice < 1 ||
			choice > poll.options.length
		)
			return;

		poll.votes[event.senderID] = choice - 1;

		const count = Array(poll.options.length).fill(0);

		for (const uid in poll.votes) {
			count[poll.votes[uid]]++;
		}

		let text = `📊 LIVE POLL\n\n❓ ${poll.question}\n\n`;

		poll.options.forEach((opt, i) => {
			text += `${i + 1}️⃣ ${opt}: ${count[i]}\n`;
		});

		text += `\n👥 Total Votes: ${Object.keys(poll.votes).length}`;

		message.reply(text);
	}
};
