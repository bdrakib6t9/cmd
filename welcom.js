const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");
const { getAvatarUrl } = require("../../rakib/customApi/getAvatarUrl");

module.exports = {
	config: {
		name: "welcom",
		version: "1.2",
		author: "Rakib",
		category: "events"
	},

	onStart: async function ({ message, event, api }) {
		if (event.logMessageType !== "log:subscribe") return;

		const { threadID, author } = event;
		const user = event.logMessageData.addedParticipants[0];
		const userName = user.fullName;

		const threadInfo = await api.getThreadInfo(threadID);
		const threadName = threadInfo.threadName || "this group";
		const memberCount = threadInfo.participantIDs.length;

		// 👤 added by
		let adderName = "User";
		try {
			const info = await api.getUserInfo(author);
			adderName = info[author]?.name || "User";
		} catch {}

		// 🖼️ avatar path
		const avatarPath = await getAvatarUrl(user.userFbId);
		const imgPath = path.join(__dirname, `welcome_${Date.now()}.png`);

		try {
			// Canvas Size (920x450 - Dynamic & Unique layout)
			const width = 920;
			const height = 450;
			const canvas = createCanvas(width, height);
			const ctx = canvas.getContext("2d");

			// 1. 🌌 PREMIUM BACKGROUND (Cyber/Space Tech Style)
			const grad = ctx.createLinearGradient(0, 0, width, height);
			grad.addColorStop(0, "#010409");
			grad.addColorStop(0.4, "#0d1117");
			grad.addColorStop(0.8, "#161b22");
			grad.addColorStop(1, "#010409");
			ctx.fillStyle = grad;
			ctx.fillRect(0, 0, width, height);

			// ব্যাকগ্রাউন্ডে হালকা ইউনিক গ্রিড বা পার্টিকেল ইফেক্ট (ইউনিক করার জন্য)
			ctx.fillStyle = "rgba(0, 195, 255, 0.08)";
			for (let i = 0; i < 40; i++) {
				let x = Math.random() * width;
				let y = Math.random() * height;
				let r = Math.random() * 2.5 + 1;
				ctx.beginPath();
				ctx.arc(x, y, r, 0, Math.PI * 2);
				ctx.fill();
			}

			// 2. 👑 TOP HEADER & TITLE
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";

			// গ্লো ইফেক্ট থ্রেড নেমের জন্য
			ctx.shadowColor = "#00c3ff";
			ctx.shadowBlur = 15;
			ctx.font = "bold 34px sans-serif";
			ctx.fillStyle = "#ffffff";
			ctx.fillText(threadName, width / 2, 55);
			ctx.shadowBlur = 0; // শ্যাডো রিসেট

			// সাবটাইটেল (মডার্ন ড্যাশ বর্ডার লুক)
			ctx.font = "bold 13px sans-serif";
			ctx.fillStyle = "#ffaa00";
			ctx.fillText("—  W E L C O M E   T O   O U R   S P A C E  —", width / 2, 100);

			// 3. 🖼️ UNIQUE AVATAR WITH DOUBLE RING GLOW
			const avatarX = 200;
			const avatarY = 260;
			const radius = 80;

			// আউটার গ্লো রিং
			ctx.strokeStyle = "rgba(0, 242, 254, 0.4)";
			ctx.lineWidth = 6;
			ctx.beginPath();
			ctx.arc(avatarX, avatarY, radius + 10, 0, Math.PI * 2);
			ctx.stroke();

			// ইনার ক্লিপিং মাস্ক (গোল প্রোফাইল)
			ctx.save();
			ctx.beginPath();
			ctx.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
			ctx.closePath();
			ctx.clip();

			try {
				const avatarImg = await loadImage(avatarPath);
				ctx.drawImage(avatarImg, avatarX - radius, avatarY - radius, radius * 2, radius * 2);
			} catch {
				ctx.fillStyle = "#21262d";
				ctx.fill();
			}
			ctx.restore();

			// মেইন বর্ডার রিং
			ctx.strokeStyle = "#00f2fe";
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
			ctx.stroke();

			// 4. 📝 MODERN INFOGRAPHICS (RIGHT SIDE)
			ctx.textAlign = "left";

			// ইউজারনেম (গ্রেডিয়েন্ট টেক্সট ইফেক্ট)
			ctx.font = "bold 38px sans-serif";
			const textGrad = ctx.createLinearGradient(320, 0, 700, 0);
			textGrad.addColorStop(0, "#ff007f");
			textGrad.addColorStop(1, "#7928ca");
			ctx.fillStyle = textGrad;
			ctx.fillText(userName, 320, 205);

			// সাব টাইটেল
			ctx.font = "16px sans-serif";
			ctx.fillStyle = "#8b949e";
			ctx.fillText("Just joined the server coordinates. 🎉", 320, 245);

			// 5. 🏷️ UNIQUE CARD BADGES (Cyberpunk Glassmorphism Effect)
			ctx.font = "bold 14px sans-serif";

			// ব্যাজ ১: মেম্বার সংখ্যা
			const b1Text = `🆔 MEMBER #${memberCount}`;
			const b1Width = ctx.measureText(b1Text).width + 30;
			ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
			ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.roundRect(320, 280, b1Width, 42, 8);
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = "#00f2fe";
			ctx.fillText(b1Text, 335, 301);

			// ব্যাজ ২: কে এড করেছে
			const b2Text = `👤 INVITED BY: ${adderName.toUpperCase()}`;
			const b2Width = ctx.measureText(b2Text).width + 30;
			const b2X = 320 + b1Width + 15;
			ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
			ctx.beginPath();
			ctx.roundRect(b2X, 280, b2Width, 42, 8);
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = "#ff007f";
			ctx.fillText(b2Text, b2X + 15, 301);

			// 6. 📱 FOOTER INFO
			ctx.font = "12px sans-serif";
			ctx.fillStyle = "#30363d";
			ctx.fillText("SYSTEM: SECURE CONNECTION ESTABLISHED", 35, height - 25);

			ctx.textAlign = "right";
			ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
			ctx.fillText("TESSA AUTOMATION v1.2", width - 35, height - 25);

			// 7. SAVE & SEND BLOCK
			const buffer = canvas.toBuffer("image/png");
			fs.writeFileSync(imgPath, buffer);

			// 🌟 মেসেজ ফরম্যাটটি আরও লাক্সারি ও প্রিমিয়াম করা হয়েছে
			const welcomeMessage = 
				`╭━━━ • 🌟 𝗪𝗘𝗟𝗖𝗢𝗠𝗘 🌟 • ━━━╮\n` +
				`  ✨ 𝗛𝗲𝗹𝗹𝗼, ${userName}!\n` +
				`   Welcome to *${threadName}*\n` +
				`╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
				`┌ 🏷️ 𝗜𝗻𝗳𝗼𝗿𝗺𝗮𝘁𝗶𝗼𝗻:\n` +
				`│ 👤 𝗔𝗱𝗱𝗲𝗱 𝗕𝘆 : ${adderName}\n` +
				`│ 🔢 𝗠𝗲𝗺𝗯𝗲𝗿 𝗡𝗼: #${memberCount}\n` +
				`└────────────────────\n\n` +
				`Enjoy your stay and have a great time here! ❤️`;

			await message.send({
				body: welcomeMessage,
				attachment: fs.createReadStream(imgPath)
			});

		} catch (error) {
			console.error("Error in welcome event:", error);
		} finally {
			if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
			if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
		}
	}
};
