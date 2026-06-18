const fs = require("fs-extra");
const path = require("path");
const fetch = require("node-fetch");
const { createCanvas, loadImage } = require("canvas");

const TMP_DIR = path.join(__dirname, "tmp");
fs.ensureDirSync(TMP_DIR);

// ====================
// Avatar Loader
// ====================
async function loadUserDP(uid) {
  try {
    const url = `https://graph.facebook.com/${uid}/picture?height=1500&width=1500&access_token=6628568379|c1e620fa708a1d5696fb991c1bde5662`;
    const res = await fetch(url);
    const buffer = Buffer.from(await res.arrayBuffer());
    return await loadImage(buffer);
  } catch (err) {
    return await loadImage("https://i.postimg.cc/kgjgP6QX/messenger-dp.png");
  }
}

// ====================
// Circular Avatar
// ====================
function drawAvatar(ctx, img, x, y, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

// ====================
// Text Wrapper
// ====================
function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine === "" ? word : currentLine + " " + word;
    const width = ctx.measureText(testLine).width;

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ====================
// Bubble Size Calculator
// ====================
function getBubbleSize(ctx, text, maxWidth = 550) {
  const lines = wrapText(ctx, text, maxWidth);
  let widest = 0;

  for (const line of lines) {
    const w = ctx.measureText(line).width;
    if (w > widest) widest = w;
  }

  return {
    width: Math.min(widest + 60, maxWidth + 60),
    height: lines.length * 52 + 45,
    lines
  };
}

// ====================
// Messenger Bubble
// ====================
function drawBubble(ctx, x, y, width, height, color, left = true) {
  const radius = 32;
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();

  if (left) {
    ctx.beginPath();
    ctx.moveTo(x, y + height - 30);
    ctx.lineTo(x - 15, y + height - 15);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + width, y + height - 30);
    ctx.lineTo(x + width + 15, y + height - 15);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.fill();
  }
}

// ====================
// Bubble Text
// ====================
function drawBubbleText(ctx, lines, x, y, color = "#fff") {
  ctx.fillStyle = color;
  ctx.font = "38px Sans-serif";
  let currentY = y;

  for (const line of lines) {
    ctx.fillText(line, x, currentY);
    currentY += 52;
  }
}

// ====================
// Parse Command
// ====================
function parseInput(text) {
  const parts = text.split("-").map(i => i.trim()).filter(Boolean);
  return {
    theme: parts[0]?.toLowerCase() || "dark",
    time: parts[1] || "12:00 PM",
    seen: parts[2]?.toLowerCase() || "yes",
    reaction: parts[3] || "❤️",
    messages: parts.slice(4)
  };
}

// ====================
// Theme Engine
// ====================
function getTheme(theme = "dark") {
  if (theme.toLowerCase() === "light") {
    return {
      background: "#FFFFFF",
      headerText: "#050505",
      statusText: "#65676B",
      leftBubble: "#E4E6EB",
      rightBubble: "#0084FF",
      leftText: "#050505",
      rightText: "#FFFFFF",
      divider: "#DADDE1"
    };
  }
  return {
    background: "#18191A",
    headerText: "#FFFFFF",
    statusText: "#B0B3B8",
    leftBubble: "#3A3B3C",
    rightBubble: "#0084FF",
    leftText: "#FFFFFF",
    rightText: "#FFFFFF",
    divider: "#3E4042"
  };
}

// ====================
// Dynamic Canvas Height
// ====================
function calculateCanvasHeight(ctx, messages) {
  let total = 260;
  ctx.font = "38px Sans-serif";
  
  for (const msg of messages) {
    const bubble = getBubbleSize(ctx, msg, 550);
    total += bubble.height + 35;
  }
  return total + 250;
}

// ====================
// Header Renderer
// ====================
function drawHeader(ctx, theme, avatar, name) {
  drawAvatar(ctx, avatar, 40, 40, 120);

  ctx.fillStyle = theme.headerText;
  ctx.font = "bold 42px Sans-serif";
  ctx.fillText(name, 190, 95);

  ctx.fillStyle = theme.statusText;
  ctx.font = "28px Sans-serif";
  ctx.fillText("Active now", 190, 140);

  ctx.beginPath();
  ctx.fillStyle = "#31A24C";
  ctx.arc(150, 140, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = theme.divider;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 210);
  ctx.lineTo(ctx.canvas.width, 210);
  ctx.stroke();
}

// ====================
// Typing Indicator
// ====================
function drawTypingIndicator(ctx, x, y, theme) {
  drawBubble(ctx, x, y, 160, 75, theme.leftBubble, true);
  ctx.fillStyle = theme.leftText;

  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x + 45 + (i * 35), y + 38, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ====================
// Message Renderer
// ====================
function renderMessages(ctx, messages, theme) {
  let y = 260;
  ctx.font = "38px Sans-serif";

  for (let i = 0; i < messages.length; i++) {
    const text = messages[i];
    const left = i % 2 === 0;
    const bubble = getBubbleSize(ctx, text, 550);
    let x = left ? 50 : ctx.canvas.width - bubble.width - 50;

    drawBubble(ctx, x, y, bubble.width, bubble.height, left ? theme.leftBubble : theme.rightBubble, left);
    drawBubbleText(ctx, bubble.lines, x + 30, y + 55, left ? theme.leftText : theme.rightText);
    
    y += bubble.height + 35;
  }
  return y;
}

// ====================
// Footer Renderer
// ====================
function drawFooter(ctx, reaction, seen, time, y, theme) {
  ctx.font = "42px Sans-serif";
  ctx.fillText(reaction, ctx.canvas.width - 120, y);

  ctx.fillStyle = theme.statusText;
  ctx.font = "28px Sans-serif";
  const statusMsg = seen === "yes" ? `Seen ${time}` : time;
  const textWidth = ctx.measureText(statusMsg).width;
  ctx.fillText(statusMsg, ctx.canvas.width - textWidth - 50, y + 50);
}

// ====================
// Background Renderer
// ====================
function drawBackground(ctx, theme) {
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

module.exports = {
  config: {
    name: "fakechat",
    aliases: ["fchat"],
    version: "2.6",
    author: "Rakib",
    role: 0,
    countDown: 5,
    shortDescription: {
      en: "Creates a stylized Facebook Messenger fake chat image."
    },
    category: "fun",
    guide: {
      en: `Mention Mode:\n+fakechat @user - dark - 12:45 PM - yes - ❤️ - hello - hi\n\nReply Mode:\n(reply to someone)\n+fakechat dark - 12:45 PM - yes - ❤️ - hello - hi`
    }
  },

  onStart: async function ({ api, event, args, message }) {
    try {
      let rawInput;
      let targetUID = null;
      let targetName = "hoon"; // শুধু শুধু কমান্ড দিলে ডিফল্ট নাম

      // যদি কোন ইনপুট না থাকে (শুধু +fakechat দিলে)
      if (args.length === 0 && (!event.mentions || Object.keys(event.mentions).length === 0) && !event.messageReply) {
        rawInput = "dark - 12:45 PM - yes - ❤️ - কিরে - কিছু না - ঘুমাবি? - না";
        // ডিফল্ট প্রোফাইল পিকচারের জন্য একটা নির্দিষ্ট আইডি দেওয়া যাক (যেমন বটের ওনার বা যেকোনো আইডি)
        targetUID = "61581351693349"; 
      } else {
        // রেগুলার ইনপুট হ্যান্ডলিং
        if (event.mentions && Object.keys(event.mentions).length) {
          const mentionName = Object.values(event.mentions)[0];
          rawInput = args.join(" ").replace(mentionName, "").trim();
        } else {
          rawInput = args.join(" ").trim();
        }
      }

      // যদি এরপরেও কোনো মেসেজ বডি না থাকে
      if (!rawInput) {
        return message.reply(
          `Example:\n\n+fakechat @mention - dark - 12:45 PM - yes - ❤️ - Hello - Hi\n\nor\n\n(reply to user)\n+fakechat dark - 12:45 PM - yes - ❤️ - Hello - Hi`
        );
      }

      // টার্গেট ইউজার বের করা (ডিফল্ট আইডি না থাকলে নরমাল প্রসেস)
      let target;
      if (targetUID) {
        try {
          const info = await api.getUserInfo(targetUID);
          target = {
            uid: targetUID,
            name: info[targetUID]?.name || targetName
          };
        } catch {
          target = { uid: targetUID, name: targetName };
        }
      } else {
        if (event.mentions && Object.keys(event.mentions).length) {
          targetUID = Object.keys(event.mentions)[0];
        } else if (event.messageReply) {
          targetUID = event.messageReply.senderID;
        } else {
          targetUID = event.senderID;
        }
        const info = await api.getUserInfo(targetUID);
        target = {
          uid: targetUID,
          name: info[targetUID]?.name || "Facebook User"
        };
      }

      const parsed = parseInput(rawInput);

      if (parsed.messages.length < 1) {
        return message.reply("Please provide at least one message.");
      }

      const avatar = await loadUserDP(target.uid);
      const theme = getTheme(parsed.theme);

      const dummyCanvas = createCanvas(1080, 100);
      const dummyCtx = dummyCanvas.getContext("2d");
      const canvasHeight = calculateCanvasHeight(dummyCtx, parsed.messages);

      const canvas = createCanvas(1080, canvasHeight);
      const ctx = canvas.getContext("2d");

      drawBackground(ctx, theme);
      drawHeader(ctx, theme, avatar, target.name);
      
      const lastY = renderMessages(ctx, parsed.messages, theme);
      
      drawTypingIndicator(ctx, 50, lastY + 10, theme);
      drawFooter(ctx, parsed.reaction, parsed.seen, parsed.time, lastY + 40, theme);

      const filePath = path.join(TMP_DIR, `fakechat_${Date.now()}.png`);
      fs.writeFileSync(filePath, canvas.toBuffer("image/png"));

      await message.reply(
        { attachment: fs.createReadStream(filePath) },
        () => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }
      );

    } catch (err) {
      console.error(err);
      return message.reply(`❌ Error:\n${err.message}`);
    }
  }
};
