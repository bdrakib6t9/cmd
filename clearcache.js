module.exports = {
	config: {
		name: "clearcache",
		aliases: ["cc", "cacheclear"],
		version: "1.0",
		author: "Rakib",
		countDown: 5,
		role: 0,
		shortDescription: {
			en: "Clear require cache"
		},
		longDescription: {
			en: "Clear Node.js require cache"
		},
		category: "owner"
	},

	onStart: async function ({ message }) {
		try {
			const cacheKeys = Object.keys(require.cache);
			let cleared = 0;

			for (const key of cacheKeys) {
				delete require.cache[key];
				cleared++;
			}

			return message.reply(
				`✅ Cache cleared successfully!\n📦 Cleared modules: ${cleared}`
			);
		}
		catch (err) {
			return message.reply(`❌ Error:\n${err.message}`);
		}
	}
};
