const { loadBox } = require("../../rakib/customId/ownBox");

// cache
const joinTime = {};
const lastMessage = {};

module.exports = {
	config: {
		name: "multibot",
		version: "1.1",
		author: "Rakib",
		role: 2,
		category: "system",
		shortDescription: "Anti multiple bot system"
	},

	onStart: async function () {
		// required for GoatBot V2
	},

	onChat: async function ({ api, event }) {
		const {
			threadID,
			senderID,
			logMessageType,
			logMessageData,
			body
		} = event;

		try {

			// USER JOIN TRACK
			if (logMessageType === "log:subscribe") {
				const addedUsers = logMessageData?.addedParticipants || [];
				for (const user of addedUsers) {
					joinTime[user.userFbId] = Date.now();
				}
			}

			// FAST NICKNAME CHANGE
			if (logMessageType === "log:user-nickname") {
				const uid = logMessageData?.participant_id;

				if (
					uid &&
					joinTime[uid] &&
					Date.now() - joinTime[uid] <= 10000
				) {
					await handleBotDetected({
						api,
						threadID,
						uid,
						reason: "nickname change fast"
					});
				}
			}

			// MEDIA + TEXT
			if (
				event.attachments?.length > 0 &&
				body &&
				body.trim().length > 0
			) {
				await handleBotDetected({
					api,
					threadID,
					uid: senderID,
					reason: "media + text"
				});
			}

			// FAST REPLY + MENTION
			if (body) {
				const now = Date.now();

				if (
					lastMessage[senderID] &&
					now - lastMessage[senderID] <= 1000 &&
					event.mentions &&
					Object.keys(event.mentions).length > 0
				) {
					await handleBotDetected({
						api,
						threadID,
						uid: senderID,
						reason: "fast reply mention"
					});
				}

				lastMessage[senderID] = now;
			}

		}
		catch (err) {
			console.log("[MULTIPLE BOT]", err);
		}
	}
};

async function handleBotDetected({
	api,
	threadID,
	uid,
	reason
}) {
	try {

		const threadInfo = await api.getThreadInfo(threadID);
		const botID = api.getCurrentUserID();

		const adminBox = await loadBox();
		const ADMIN_LOG_THREAD = adminBox;

		const userName = await getUserName(api, uid);

		await api.sendMessage({
			body:
				`⚠️ Multiple Bot Detected\n\n` +
				`User: ${userName}\n` +
				`Reason: ${reason}\n\n` +
				`⏳ 20 সেকেন্ডের মধ্যে remove না করলে action নেওয়া হবে।`,
			mentions: [{
				id: uid,
				tag: userName
			}]
		}, threadID);

		setTimeout(async () => {
			try {

				const updatedInfo = await api.getThreadInfo(threadID);

				const stillExists =
					updatedInfo.participantIDs.includes(uid);

				if (!stillExists)
					return;

				const botIsAdmin =
					updatedInfo.adminIDs.some(
						item => item.id == botID
					);

				if (botIsAdmin) {

					await api.removeUserFromGroup(
						uid,
						threadID
					);

					await api.sendMessage(
						`✅ Removed: ${userName}`,
						threadID
					);

				}
				else {

					await api.sendMessage(
						"❌ Multiple bot detected, leaving group.",
						threadID
					);

					if (ADMIN_LOG_THREAD) {
						await api.sendMessage(
							`⚠️ MULTIPLE BOT DETECTED\n\nGroup: ${updatedInfo.threadName}\nThreadID: ${threadID}`,
							ADMIN_LOG_THREAD
						);
					}

					await api.removeUserFromGroup(
						botID,
						threadID
					);

				}

			}
			catch (err) {
				console.log("[MULTIPLE BOT DELAY]", err);
			}
		}, 20000);

	}
	catch (err) {
		console.log("[MULTIPLE BOT HANDLER]", err);
	}
}

async function getUserName(api, uid) {
	try {
		const user = await api.getUserInfo(uid);
		return user[uid]?.name || "Unknown User";
	}
	catch {
		return "Unknown User";
	}
}
