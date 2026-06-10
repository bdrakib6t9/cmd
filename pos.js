const axios = require("axios");
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");
const { getAvatarUrl } = require("../../rakib/customApi/getAvatarUrl");

module.exports = {
  config: {
    name: "pos",
    aliases: ["por"],
    author: "Rakib",
    category: "love",
  },

  onStart: async function ({ api, event, usersData }) {
    try {
      const senderID = event.senderID;

      const senderData = await usersData.get(senderID);
      const senderName = senderData.name;

      const threadData = await api.getThreadInfo(event.threadID);

if (!threadData || !threadData.userInfo) {
  return api.sendMessage("❌ Failed to get user list.", event.threadID);
}
      const users = threadData.userInfo;

      const myData = users.find(u => u.id === senderID);
      if (!myData || !myData.gender) {
  return api.sendMessage("⚠️ Gender data not available for matching.", event.threadID);
      }
      const myGender = myData.gender;

      let matchCandidates = users.filter(
        u =>
          u.id !== senderID &&
          ((myGender === "MALE" && u.gender === "FEMALE") ||
           (myGender === "FEMALE" && u.gender === "MALE"))
      );

      if (!matchCandidates.length)
        return api.sendMessage("❌ No suitable match found.", event.threadID);

      const selectedMatch =
        matchCandidates[Math.floor(Math.random() * matchCandidates.length)];

      const matchName = selectedMatch.name;

      /* ================= BACKGROUNDS ================= */

      const backgrounds = [
        {
          id: 1,
          url: "https://drive.google.com/uc?export=download&id=14tE4z8bZDv_Xco8V1WUgE4g0uZ-5CVYi",
          type: "normal",
          pos: [{ x: 385, y: 40, w: 180, h: 180 }, { x: 585, y: 180, w: 180, h: 180 }]
        },
        {
          id: 2,
          url: "https://drive.google.com/uc?export=download&id=1fMiWIjFjJk9q89JPyAYU4LHHfoM_3N4w",
          type: "normal",
          pos: [{ x: 385, y: 40, w: 180, h: 180 }, { x: 585, y: 180, w: 180, h: 180 }]
        },
        {
          id: 3,
          url: "https://drive.google.com/uc?export=download&id=1BJQy4sj7lStDL1flpuZROuav2Ez2Wy21",
          type: "normal",
          pos: [{ x: 385, y: 40, w: 180, h: 180 }, { x: 585, y: 180, w: 180, h: 180 }]
        },
        {
          id: 4,
          url: "https://drive.google.com/uc?export=download&id=1v3ix13pgp9Lkbl7MaF968SNPTOlkf_Y_",
          type: "circle",
          pos: [
            { x: 955, y: 185, size: 200 },
            { x: 115, y: 185, size: 200 }
          ]
        },
        {
          id: 5,
          url: "https://drive.google.com/uc?export=download&id=19QEwghmb2jOmmqeFG-9ouAWYtQyHd0NF",
          type: "normal",
          pos: [{ x: 111, y: 175, w: 330, h: 330 }, { x: 1018, y: 173, w: 330, h: 330 }]
        },
        {
          id: 6,
          url: "https://drive.google.com/uc?export=download&id=1O9iMotJXZxXHy8fdT-w7MG7es8-OE_VI",
          type: "circle",
          pos: [{ x: 380, y: 35, size: 180 }, { x: 583, y: 185, size: 180 }]
        },
        {
          id: 7,
          url: "https://drive.google.com/uc?export=download&id=1rAIJ0Z4pBCfd_1HrjRYEdKi22NvMzgvI",
          type: "normal",
          pos: [{ x: 120, y: 170, w: 300, h: 300 }, { x: null, y: 170, w: 300, h: 300 }]
        },
        {
          id: 8,
          url: "https://drive.google.com/uc?export=download&id=1gOs0rosaWNZWq5OsoDaWoGE41hqn4DRd",
          type: "circle",
          pos: [{ x: 65, y: 104, size: 210 }, { x: 460, y: 104, size: 210 }]
        },

        { id: 9, type: "dynamic" },
        { id: 10, type: "dynamic" },
        { id: 11, type: "dynamic" }
      ];

      /* ================= SELECT BG ================= */

      const args = event.body.trim().split(/\s+/);
      let selectedBg;

      if (args[1] && !isNaN(args[1])) {
        selectedBg = backgrounds.find(bg => bg.id == args[1]);
        if (!selectedBg)
          return api.sendMessage("❌ Invalid number! Use 1-11", event.threadID);
      } else {
        selectedBg = backgrounds[Math.floor(Math.random() * backgrounds.length)];
      }

      /* ================= CANVAS ================= */

      let canvas, ctx;

      if (selectedBg.type === "dynamic") {
        canvas = createCanvas(900, 500);
        ctx = canvas.getContext("2d");
      } else {
        const res = await axios.get(selectedBg.url, { responseType: "arraybuffer" });
        const baseImage = await loadImage(Buffer.from(res.data));

        canvas = createCanvas(baseImage.width, baseImage.height);
        ctx = canvas.getContext("2d");

        ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
      }

      const W = canvas.width;
      const H = canvas.height;

      const avatar1 = await loadImage(await getAvatarUrl(senderID));
      const avatar2 = await loadImage(await getAvatarUrl(selectedMatch.id));

      const lovePercent = Math.floor(Math.random() * 31) + 70;
      const compatibility = Math.floor(Math.random() * 21) + 80;

      function drawCircle(ctx, img, x, y, size) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, x, y, size, size);
        ctx.restore();
      }

      function drawDynamicUI(ctx, W, H, name1, name2, lovePercent, compatibility) {

        ctx.shadowColor = "#ff4d6d";
        ctx.shadowBlur = 25;

        ctx.font = "bold 80px sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";

        ctx.fillText("❤️", W / 2, H / 2 - 10);

        ctx.font = "bold 55px sans-serif";
        ctx.fillStyle = "#00f7ff";
        ctx.fillText(lovePercent + "%", W / 2, H / 2 + 70);

        ctx.shadowBlur = 0;

        const grad = ctx.createLinearGradient(W/2 - 120, 0, W/2 + 120, 0);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.5, "#ffffff");
        grad.addColorStop(1, "transparent");

        ctx.fillStyle = grad;
        ctx.fillRect(W/2 - 120, H/2 + 90, 240, 2);

        ctx.font = "bold 28px sans-serif";

        ctx.fillStyle = "#00f7ff";
        ctx.fillText(name1, 250, H / 2 + 150);

        ctx.fillStyle = "#ff00c8";
        ctx.fillText(name2, W - 250, H / 2 + 150);

        // 👉 compatibility text add (UI তেও দেখানোর জন্য)
ctx.save();

const soulGrad = ctx.createLinearGradient(W/2 - 100, 0, W/2 + 100, 0);
soulGrad.addColorStop(0, "#ff9a9e");
soulGrad.addColorStop(0.5, "#fad0c4");
soulGrad.addColorStop(1, "#a18cd1");

ctx.font = "bold 26px sans-serif";
ctx.fillStyle = soulGrad;
ctx.textAlign = "center";

ctx.shadowColor = "#ff9a9e";
ctx.shadowBlur = 15;

ctx.fillText("❀ " + compatibility + "% Soul", W / 2, H / 2 + 200);
const lineGrad = ctx.createLinearGradient(W/2 - 80, 0, W/2 + 80, 0);
lineGrad.addColorStop(0, "transparent");
lineGrad.addColorStop(0.5, "#ffffff");
lineGrad.addColorStop(1, "transparent");

ctx.shadowBlur = 0;
ctx.fillStyle = lineGrad;
ctx.fillRect(W/2 - 80, H/2 + 215, 160, 2);

ctx.restore();
}


      function drawNeonAvatar(ctx, img, cx, cy, colorSet) {
        const r = 100;

        const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        ring.addColorStop(0, colorSet[0]);
        ring.addColorStop(0.5, colorSet[1]);
        ring.addColorStop(1, colorSet[2]);

        ctx.beginPath();
        ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
        ctx.strokeStyle = ring;
        ctx.lineWidth = 10;
        ctx.shadowColor = colorSet[0];
        ctx.shadowBlur = 25;
        ctx.stroke();

        ctx.shadowBlur = 0;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
      }

      if (selectedBg.type === "dynamic") {

        //////////////////////////////////////////
        //////////////// ID 9 ////////////////////
        //////////////////////////////////////////

        if (selectedBg.id === 9) {

  // 🌈 soft romantic gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#ff4d6d");
  grad.addColorStop(1, "#ff9a9e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 💓 pulse rings (enhanced glow)
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(W/2, H/2, 120 + i*30, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(255,255,255,${0.1 - i*0.02})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ff4d6d";
    ctx.shadowBlur = 15;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // 💖 orbit hearts (rotation illusion)
  const baseAngle = Date.now() * 0.002; // pseudo animation feel
  for (let i = 0; i < 12; i++) {
    const angle = baseAngle + (Math.PI * 2 / 12) * i;
    const x = W/2 + Math.cos(angle) * 140;
    const y = H/2 + Math.sin(angle) * 140;

    ctx.globalAlpha = 0.8;
    ctx.font = "20px serif";
    ctx.fillText("love", x, y);
  }
  ctx.globalAlpha = 1;

  // ✨ premium spark particles
  for (let i = 0; i < 60; i++) {
    ctx.globalAlpha = Math.random();
    ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#ffe6eb";
    ctx.fillRect(Math.random()*W, Math.random()*H, 2, 2);
  }
  ctx.globalAlpha = 1;

  // 👇 avatars (FIXED colorSet)
  drawNeonAvatar(ctx, avatar1, 250, H/2, ["#ff4d6d","#ff00cc","#ff7eb3"]);
  drawNeonAvatar(ctx, avatar2, W-250, H/2, ["#ff4d6d","#ff00cc","#ff7eb3"]);

  // 💘 smooth pulse beam (wave improved)
  ctx.beginPath();
  ctx.moveTo(300, H/2);

  for (let x = 300; x < W-300; x += 10) {
    const y = H/2 + Math.sin(x*0.03) * 12;
    ctx.lineTo(x, y);
  }

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.shadowColor = "#ff4d6d";
  ctx.shadowBlur = 15;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 🔥 UI call (FIXED)
  drawDynamicUI(ctx, W, H, senderName, matchName, lovePercent, compatibility);
        }


        //////////////////////////////////////////
        //////////////// ID 10 ///////////////////
        //////////////////////////////////////////
         if (selectedBg.id === 10) {

  // 🌌 deep sky gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#000814");
  grad.addColorStop(1, "#001d3d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ✨ star field (enhanced)
  const stars = [];
  for (let i = 0; i < 100; i++) {
    const x = Math.random()*W;
    const y = Math.random()*H;
    const r = Math.random()*2 + 0.5;

    stars.push({x,y});

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = "white";
    ctx.shadowColor = "#00f7ff";
    ctx.shadowBlur = 5;
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // 🔗 constellation lines (smoother)
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;

  for (let i = 0; i < stars.length; i++) {
    for (let j = i+1; j < stars.length; j++) {
      const dx = stars[i].x - stars[j].x;
      const dy = stars[i].y - stars[j].y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < 110) {
        ctx.beginPath();
        ctx.moveTo(stars[i].x, stars[i].y);
        ctx.lineTo(stars[j].x, stars[j].y);
        ctx.stroke();
      }
    }
  }

  // 👇 avatars (FIXED colorSet)
  drawNeonAvatar(ctx, avatar1, 250, H/2, ["#00c6ff","#0072ff","#00f7ff"]);
  drawNeonAvatar(ctx, avatar2, W-250, H/2, ["#00c6ff","#0072ff","#00f7ff"]);

  // 🌟 main connection beam (enhanced glow)
  ctx.beginPath();
  ctx.moveTo(300, H/2);
  ctx.lineTo(W-300, H/2);
  ctx.strokeStyle = "#00f7ff";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#00f7ff";
  ctx.shadowBlur = 15;
  ctx.setLineDash([6,6]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  // 🔥 UI call (FIXED)
  drawDynamicUI(ctx, W, H, senderName, matchName, lovePercent, compatibility);
         }


        //////////////////////////////////////////
        //////////////// ID 11 ///////////////////
        //////////////////////////////////////////
        if (selectedBg.id === 11) {

  // 🌌 night gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#000000");
  grad.addColorStop(1, "#1a0033");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 🌙 moon with glow
  const mx = W/2;
  const my = 140;

  const moonGlow = ctx.createRadialGradient(mx, my, 10, mx, my, 100);
  moonGlow.addColorStop(0, "#ffffff");
  moonGlow.addColorStop(1, "transparent");

  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(mx, my, 100, 0, Math.PI*2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(mx, my, 60, 0, Math.PI*2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // ✨ stars (twinkle style)
  for (let i = 0; i < 60; i++) {
    const x = Math.random()*W;
    const y = Math.random()*(H/2);

    ctx.globalAlpha = Math.random();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  // 🌫️ fog layer (depth)
  const fog = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 400);
  fog.addColorStop(0, "rgba(255,255,255,0.05)");
  fog.addColorStop(1, "transparent");

  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, W, H);

  // 🌊 reflection (enhanced water wave)
  for (let i = 0; i < 25; i++) {
    ctx.beginPath();
    ctx.moveTo(0, H/2 + i*5);

    for (let x = 0; x < W; x += 15) {
      const y = H/2 + i*5 + Math.sin(x*0.02 + i*0.5) * 4;
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = `rgba(255,255,255,${0.06 - i*0.002})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 👇 avatars (FIXED)
  drawNeonAvatar(ctx, avatar1, 250, H/2, ["#ff0080","#ff4d6d","#ff00cc"]);
  drawNeonAvatar(ctx, avatar2, W-250, H/2, ["#ff0080","#ff4d6d","#ff00cc"]);


  // 🔥 UI call (FIXED)
  drawDynamicUI(ctx, W, H, senderName, matchName, lovePercent, compatibility);
        }

    ////////////////////////////////////////////////////////////
      } else {

        if (selectedBg.type === "circle") {
          drawCircle(ctx, avatar1, selectedBg.pos[0].x, selectedBg.pos[0].y, selectedBg.pos[0].size);

          const x2 = selectedBg.pos[1].x !== null
            ? selectedBg.pos[1].x
            : canvas.width - selectedBg.pos[1].size - 120;

          drawCircle(ctx, avatar2, x2, selectedBg.pos[1].y, selectedBg.pos[1].size);

        } else {
          ctx.drawImage(avatar1, selectedBg.pos[0].x, selectedBg.pos[0].y, selectedBg.pos[0].w, selectedBg.pos[0].h);

          const x2 = selectedBg.pos[1].x !== null
            ? selectedBg.pos[1].x
            : canvas.width - selectedBg.pos[1].w - 120;

          ctx.drawImage(avatar2, x2, selectedBg.pos[1].y, selectedBg.pos[1].w, selectedBg.pos[1].h);
        }
      }

      const outputPath = path.join(__dirname, "pair_output.png");

      const out = fs.createWriteStream(outputPath);
      canvas.createPNGStream().pipe(out);

      out.on("finish", () => {
        api.sendMessage({
          body: `💖✨ 𝐄𝐥𝐞𝐠𝐚𝐧𝐭 𝐏𝐚𝐢𝐫 𝐑𝐞𝐯𝐞𝐚𝐥 ✨💖
🌙 𝑻𝒐𝒏𝒊𝒈𝒉𝒕, 𝒅𝒆𝒔𝒕𝒊𝒏𝒚 𝒘𝒉𝒊𝒔𝒑𝒆𝒓𝒔 𝒔𝒐𝒇𝒕𝒍𝒚...
💫 𝑻𝒘𝒐 𝒔𝒐𝒖𝒍𝒔 𝒎𝒆𝒆𝒕 𝒖𝒏𝒅𝒆𝒓 𝒕𝒉𝒆 𝒈𝒍𝒐𝒘 𝒐𝒇 𝒇𝒂𝒕𝒆.
━━━━━━━━━━━━━━━
💞 ${senderName}
💞 ${matchName}
——————————
❤️ 𝑳𝒐𝒗𝒆 𝑹𝒂𝒕𝒊𝒏𝒈: ${lovePercent}%
🌟 𝑺𝒐𝒖𝒍 𝑨𝒍𝒊𝒈𝒏𝒎𝒆𝒏𝒕: ${compatibility}%
━━━━━━━━━━━━━━━
💌 𝑴𝒂𝒚 𝒕𝒉𝒊𝒔 𝒃𝒐𝒏𝒅 𝒈𝒓𝒐𝒘 𝒔𝒕𝒓𝒐𝒏𝒈𝒆𝒓 𝒆𝒗𝒆𝒓𝒚 𝒅𝒂𝒚 ✨`,
          attachment: fs.createReadStream(outputPath)
        }, event.threadID, () => fs.unlinkSync(outputPath));
      });

    } catch (err) {
      api.sendMessage("❌ Error:\n" + err.message, event.threadID);
    }
  }
};