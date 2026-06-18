const fs = require("fs-extra");
const path = require("path");
const fetch = require("node-fetch");
const { createCanvas, loadImage } = require("canvas");
const { getAvatarUrl } = require("../../rakib/customApi/getAvatarUrl");

function drawBubble(ctx, x, y, w, h, color, tailLeft = true) {
  const radius = 40;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.fill();

  if (tailLeft) {
    ctx.beginPath();
    ctx.moveTo(x, y + 60);
    ctx.lineTo(x - 38, y + 90);
    ctx.lineTo(x, y + 120);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + w, y + 60);
    ctx.lineTo(x + w + 38, y + 90);
    ctx.lineTo(x + w, y + 120);
    ctx.closePath();
    ctx.fill();
  }
}

module.exports = {
  config: {
    name: "fchat",
    aliases: ["fchat"],
    version: "2.0",
    author: "Rakib",
    role: 0,
    countDown: 5,
    shortDescription: { en: "Messenger FakeChat via Reply" },
    category: "fun",
    guide: { en: "Reply to a message with: +fakechat msg1 - [msg2]" }
  },

  onStart: async function ({ args, message, event, api }) {
    // চেক করা হচ্ছে ব্যবহারকারী কোনো মেসেজে রিপ্লাই করেছে কিনা
    if (event.type !== "message_reply") {
      return message.reply("❌ দয়া করে যার নামে ফেক চ্যাট বানাতে চান, তার যেকোনো একটি মেসেজে রিপ্লাই করে কমান্ডটি লিখুন।");
    }

    if (args.length === 0) {
      return message.reply("ব্যবহারের নিয়ম:\n+fakechat প্রথম মেসেজ - দ্বিতীয় মেসেজ (ঐচ্ছিক)");
    }

    // ইনপুট টেক্সট প্রসেসিং
    const input = args.join(" ").split("-").map(a => a.trim());
    let [text1, text2 = ""] = input;

    // রিপ্লাই করা ব্যক্তির UID এবং নাম সংগ্রহ
    const uid = event.messageReply.senderID;
    let name = "User";
    try {
      const info = await api.getUserInfo(uid);
      name = info[uid]?.name || "User";
    } catch {}

    // কাস্টম API এর মাধ্যমে প্রোফাইল পিকচার লোড
    let dp;
    try {
      const avatarUrl = await getAvatarUrl(uid);
      dp = await loadImage(avatarUrl);
    } catch (e) {
      dp = await loadImage("https://i.postimg.cc/kgjgP6QX/messenger-dp.png");
    }

    // Canvas তৈরি
    const width = 1080, height = 1500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // ডার্ক ব্যাকগ্রাউন্ড
    ctx.fillStyle = "#18191A";
    ctx.fillRect(0, 0, width, height);

    // প্রোফাইল পিকচার ড্র করা (Circle Crop)
    ctx.save();
    ctx.beginPath();
    ctx.arc(120, 180, 90, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(dp, 30, 90, 180, 180);
    ctx.restore();

    // নাম এবং একটিভ স্ট্যাটাস
    ctx.fillStyle = "#fff";
    ctx.font = "300 55px Sans-serif";
    ctx.fillText(name, 250, 160);
    ctx.fillStyle = "#aaa";
    ctx.font = "300 40px Sans-serif";
    ctx.fillText("Active now", 250, 210);

    // বাম পাশের বাবল (যার মেসেজে রিপ্লাই করা হয়েছে - ধূসর রঙ)
    drawBubble(ctx, 50, 280, 700, 150, "#242526", true);
    ctx.fillStyle = "#fff";
    ctx.font = "300 55px Sans-serif";
    ctx.fillText(text1, 90, 370);

    // ডান পাশের বাবল (যে কমান্ড ব্যবহার করেছে - নীল রঙ)
    if (text2) {
      const bubbleX = width - 50 - 700;
      drawBubble(ctx, bubbleX, 480, 700, 150, "#0560FF", false);
      ctx.fillStyle = "#fff";
      ctx.font = "300 55px Sans-serif";
      ctx.fillText(text2, bubbleX + 40, 570);
    }

    // ইমেজ সেভ এবং সেন্ড করা
    const imgPath = path.join(__dirname, "tmp", `fakechat_${event.senderID}.png`);
    fs.ensureDirSync(path.dirname(imgPath));
    fs.writeFileSync(imgPath, canvas.toBuffer());

    message.reply({ attachment: fs.createReadStream(imgPath) }, () => fs.unlinkSync(imgPath));
  }
};
