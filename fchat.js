const fs = require("fs-extra");
const path = require("path");
const fetch = require("node-fetch");
const { createCanvas, loadImage } = require("canvas");
const { getAvatarUrl } = require("../../rakib/customApi/getAvatarUrl");


function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}


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
    ctx.moveTo(x, y + 40);
    ctx.lineTo(x - 25, y + 65);
    ctx.lineTo(x, y + 90);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + w, y + 40);
    ctx.lineTo(x + w + 25, y + 65);
    ctx.lineTo(x + w, y + 90);
    ctx.closePath();
    ctx.fill();
  }
}

module.exports = {
  config: {
    name: "fchat",
    aliases: ["fchat"],
    version: "1.0",
    author: "Rakib",
    role: 0,
    countDown: 5,
    shortDescription: { en: "Multi-line Multi-bubble FakeChat" },
    category: "fun",
    guide: { en: "Reply with: fakechat msg1 - msg2 - msg3 - msg4..." }
  },

  onStart: async function ({ args, message, event, api }) {
    if (event.type !== "message_reply") {
      return message.reply("❌ দয়া করে যার নামে ফেক চ্যাট বানাতে চান, তার যেকোনো একটি মেসেজে রিপ্লাই করে কমান্ডটি লিখুন।");
    }

    if (args.length === 0) {
      return message.reply("ব্যবহারের নিয়ম:\n fakechat hi - hlw - ki koro - valo");
    }

    // ড্যাশ (-) দিয়ে সব মেসেজ আলাদা করা হচ্ছে
    const messages = args.join(" ").split("-").map(a => a.trim()).filter(a => a !== "");

    const uid = event.messageReply.senderID;
    let name = "User";
    try {
      const info = await api.getUserInfo(uid);
      name = info[uid]?.name || "User";
    } catch {}

    let dp;
    try {
      const avatarUrl = await getAvatarUrl(uid);
      dp = await loadImage(avatarUrl);
    } catch (e) {
      dp = await loadImage("https://i.postimg.cc/kgjgP6QX/messenger-dp.png");
    }

    // চ্যাটের পরিমাণের ওপর ভিত্তি করে ক্যানভাসের উচ্চতা ডাইনামিক হবে
    const width = 1080;
    let estimatedHeight = 400 + (messages.length * 220); // প্রতি বাবলের জন্য আনুমানিক জায়গা
    const height = Math.max(1500, estimatedHeight); // সর্বনিম্ন ১৫০০ পিক্সেল, বেশি হলে বাড়বে

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // ব্যাকগ্রাউন্ড
    ctx.fillStyle = "#18191A";
    ctx.fillRect(0, 0, width, height);

    // প্রোফাইল পিকচার
    ctx.save();
    ctx.beginPath();
    ctx.arc(120, 180, 90, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(dp, 30, 90, 180, 180);
    ctx.restore();

    // নাম ও স্ট্যাটাস
    ctx.fillStyle = "#fff";
    ctx.font = "300 55px Sans-serif";
    ctx.fillText(name, 250, 160);
    ctx.fillStyle = "#aaa";
    ctx.font = "300 40px Sans-serif";
    ctx.fillText("Active now", 250, 210);

    // মেসেজগুলো লুপ চালিয়ে ড্র করা
    let currentY = 320; // প্রথম বাবলের শুরুর পজিশন
    const maxBubbleWidth = 700;
    const lineHeight = 65; // প্রতি লাইনের উচ্চতা

    ctx.font = "300 52px Sans-serif"; // চ্যাট টেক্সট ফন্ট

    messages.forEach((text, index) => {
      // লাইন র‍্যাপিং চেক
      const wrappedLines = wrapText(ctx, text, maxBubbleWidth - 80);
      
      // লাইনের সংখ্যা অনুযায়ী বাবলের উচ্চতা নির্ধারণ
      const bubbleHeight = (wrappedLines.length * lineHeight) + 60; 
      const isLeft = index % 2 === 0; // জোড় সংখ্যার মেসেজ বামে, বিজোড় ডানে

      if (isLeft) {
        // বাম পাশের বাবল (টার্গেট ইউজার)
        drawBubble(ctx, 60, currentY, maxBubbleWidth, bubbleHeight, "#242526", true);
        ctx.fillStyle = "#fff";
        wrappedLines.forEach((line, lineIndex) => {
          ctx.fillText(line, 100, currentY + 70 + (lineIndex * lineHeight));
        });
      } else {
        // ডান পাশের বাবল (আপনি)
        const bubbleX = width - 60 - maxBubbleWidth;
        drawBubble(ctx, bubbleX, currentY, maxBubbleWidth, bubbleHeight, "#0560FF", false);
        ctx.fillStyle = "#fff";
        wrappedLines.forEach((line, lineIndex) => {
          ctx.fillText(line, bubbleX + 40, currentY + 70 + (lineIndex * lineHeight));
        });
      }

      // পরবর্তী বাবলের জন্য Y অক্ষে গ্যাপ তৈরি
      currentY += bubbleHeight + 40; 
    });

    // ইমেজ ক্রপ করা (অতিরিক্ত খালি জায়গা বাদ দেওয়ার জন্য)
    const finalHeight = Math.min(height, currentY + 50);
    const finalCanvas = createCanvas(width, finalHeight);
    const finalCtx = finalCanvas.getContext("2d");
    finalCtx.drawImage(canvas, 0, 0, width, finalHeight, 0, 0, width, finalHeight);

    // ইমেজ সেভ ও সেন্ড
    const imgPath = path.join(__dirname, "tmp", `fakechat_${event.senderID}.png`);
    fs.ensureDirSync(path.dirname(imgPath));
    fs.writeFileSync(imgPath, finalCanvas.toBuffer());

    message.reply({ attachment: fs.createReadStream(imgPath) }, () => fs.unlinkSync(imgPath));
  }
};
