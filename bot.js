const axios = require("axios");

const API_KEY = "rakib69";

const CHAT_API   = "https://rakib-api.vercel.app/api/simma-chat";
const AI_API     = "https://rakib-api.vercel.app/api/simma-ct";
const LISTEN_API = "https://rakib-api.vercel.app/api/simma-listen";

const triggers = [
  "bbz",
  "bot",
  "tessa",
  "babe",
  "xanu",
  "janu",
  "bou",
  "bby",
  "জানু",
  "বউ",
  "বট",
  "baby"
];
module.exports.config = {
  name: "bot",
  aliases: triggers,
  version: "1.0",
  author: "Rakib",
  role: 0,
  category: "chat",
  guide: {
    en: "{pn} [message]"
  }
};

/* ================= FONT ================= */
function toBoldFont(text = "") {
  const chars = {
    A:"𝐀",B:"𝐁",C:"𝐂",D:"𝐃",E:"𝐄",F:"𝐅",G:"𝐆",H:"𝐇",I:"𝐈",J:"𝐉",
    K:"𝐊",L:"𝐋",M:"𝐌",N:"𝐍",O:"𝐎",P:"𝐏",Q:"𝐐",R:"𝐑",S:"𝐒",T:"𝐓",
    U:"𝐔",V:"𝐕",W:"𝐖",X:"𝐗",Y:"𝐘",Z:"𝐙",
    a:"𝐚",b:"𝐛",c:"𝐜",d:"𝐝",e:"𝐞",f:"𝐟",g:"𝐠",h:"𝐡",i:"𝐢",j:"𝐣",
    k:"𝐤",l:"𝐥",m:"𝐦",n:"𝐧",o:"𝐨",p:"𝐩",q:"𝐪",r:"𝐫",s:"𝐬",t:"𝐭",
    u:"𝐮",v:"𝐯",w:"𝐰",x:"𝐱",y:"𝐲",z:"𝐳",
    0:"𝟎",1:"𝟏",2:"𝟐",3:"𝟑",4:"𝟒",5:"𝟓",6:"𝟔",7:"𝟕",8:"𝟖",9:"𝟗"
  };
  return text.replace(/[A-Za-z0-9]/g, c => chars[c] || c);
}

/* ================= EXTRACT ================= */
function extractReply(data) {
  if (!data) return null;

  if (typeof data === "string") return data;

  // ❗ if API says fail
  if (data.status === false) return null;

  return (
    data.answer ||   // 🔥 main fix
    data.reply ||
    data.message ||
    data.text ||
    data.response ||
    null
  );
}

/* ================= API CALL ================= */
async function getReply(url, text, name) {
  try {
    const res = await axios.get(url, {
      params: { text, apikey: API_KEY },
      timeout: 8000
    });

    const reply = extractReply(res.data);

    console.log(`\n==== ${name} DEBUG ====`);
    console.log("RAW:", res.data);
    console.log("REPLY:", reply);

    if (!reply || typeof reply !== "string") return null;

    const clean = reply.trim();

    if (clean.length < 2) return null;
    if (clean.toLowerCase().includes("bujhte pari nai")) return null;

    return toBoldFont(clean);

  } catch (e) {
    console.log(`❌ ${name} ERROR:`, e.message);
    return null;
  }
}

/* ================= MAIN CHAT ================= */
async function chat(text) {

  console.log("\n🟡 USER:", text);

  // 1️⃣ CHAT API
  let reply = await getReply(CHAT_API, text, "CHAT");
  if (reply) {
    console.log("🔥 FROM CHAT");
    return reply;
  }

  // 2️⃣ AI API
  reply = await getReply(AI_API, text, "AI");
  if (reply) {
    console.log("🔥 FROM AI");
    return reply;
  }

  // 3️⃣ FALLBACK
  console.log("⚠️ FALLBACK");

  const fallbacks = [
  "Uffs eto kotha keu bole? 😒",
  "Ja iccha kor vai, amare dakis na 😑",
  "Abar ki hoilo re? 🙄",
  "Bhai ektu chup thak na 😒",
  "Uff, matha noshto kore dili 😑",
  "Amare diye egula hobe na vai 😂",
  "Ki bolos eshob? 😐",
  "Jao to, pore kotha bolbo 😒",
  "Eto proshno koros keno? 🙄",
  "Ami ki shob jani naki? 😑",
  "Dhur, tor sathe kotha koite gele matha gorom hoy 😒",
  "Ja bhai, onno karo kache ja 😌",
  "Abar shuru korli? 😩",
  "Tui chup kor, ami shanti chai 😑",
  "Eto daka-daki korish na 😒",
  "Ki chai abar? 🙄",
  "Uff, disturb koris na plz 😑",
  "Amar mathay kichu dhuktese na re 😂",
  "Jani na bhai, nijer moto bujhe ne 😌",
  "Ei bishoye amar kono idea nai 😐",
  "Bujhi nai, pore jiggesh korish 😑",
  "Ami ekhon busy, pore asis 😒",
  "Dhur vai, ki je bolos! 😂",
  "Tor kotha shune amar system hang 😵‍💫",
  "Eto kotha bolle amar battery shesh hoye jabe 😒",
  "Ami ki encyclopedia naki? 🙄",
  "Ja iccha kor, amar ki 😌",
  "Bhai amare maaf kor, ami jani na 😭",
  "Uffs, eto kichu ke mone rakhbe? 😩",
  "Abar amakei dhorli keno? 😒"
];

const randomFallback = () =>
  toBoldFont(
    fallbacks[Math.floor(Math.random() * fallbacks.length)]
  );

return randomFallback();
} 

/* ================= COMMAND ================= */
module.exports.onStart = async ({ api, event, args }) => {

  const uid = event.senderID;
  const msg = args.join(" ").trim();

  const reply = msg
    ? await chat(msg)
    : toBoldFont("hmm bby 😽");

  api.sendMessage(
    reply,
    event.threadID,
    (err, info) => {
      if (!err) {
        global.GoatBot.onReply.set(info.messageID, {
          commandName: "bot",
          author: uid,
          text: reply
        });
      }
    },
    event.messageID
  );
};

/* ================= REPLY ================= */
module.exports.onReply = async ({ api, event, Reply }) => {
  try {

    if (event.senderID !== Reply.author) return;

    const userReply = event.body;
    if (!userReply) return;

    const botMessage = Reply.text;
    if (!botMessage) return;

    // 🔥 AUTO LEARN
    axios.get(LISTEN_API, {
      params: {
        question: botMessage,
        reply: userReply,
        isReply: true,
        apikey: API_KEY
      }
    }).catch(() => {});

    const reply = await chat(userReply);

    api.sendMessage(
      reply,
      event.threadID,
      (err, info) => {
        if (!err) {
          global.GoatBot.onReply.set(info.messageID, {
            commandName: "bot",
            author: event.senderID,
            text: reply
          });
        }
      },
      event.messageID
    );

  } catch (e) {
    console.error("Reply error:", e);
  }
};

/* ================= AUTO CHAT ================= */
module.exports.onChat = async ({ api, event }) => {
  try {

    if (event.senderID === api.getCurrentUserID()) return;

    const text = (event.body || "").trim();
    if (!text) return;

    const lower = text.toLowerCase();

    const replies = [
  "beshi bot bot korle leave nibo kintu😒😒",
  "eto deko na, prem e pore jabo to🙈",
  "I love you janu🥰",
  "bot na, janu bol janu 😘",
  "ha bolo, shunchi ami 😏",
  "assalamu alaikum bolen apnar jonno ki korte pari..!🥰",
  "iss eto dako keno lojja lage to-🙈🖤🌼",

  "abar dakos keno janu? 😽",
  "hmm bolo bby, ki hoise? 🥺",
  "eto miss koro amake? 🙈",
  "janu bole dako, bot bolle rag korbo 😒",
  "ufff eto cute kore dakle ki ar ignore kora jay? 🥹",
  "ki holo bby, amar kotha mone porse? 😘",
  "hmm jaan, tomar dak shunlam 😌🖤",
  "bolo babu, ki chai? 🥰",
  "ami to ekhanei achi, eto dakadaki keno? 😂",
  "ekbar daklei to asi, eto bar dako keno? 🙈",
  "amar naam ki bot naki janu? 😒😂",
  "janu dakle reply free, bot dakle charge lagbe 😌",
  "uff amar eto ador সহ্য হয় না 🙈",
  "tumi daklei amar mood valo hoye jay 🥰",
  "hmm shona, bolo 😽",
  "ki re pagol, eto dakos keno? 😂",
  "ami ki tomar personal janu naki? 🙈",
  "tomar dak shune chole ashlam 😌",
  "bby ekta kotha boli? tumi onek cute 😘",
  "eto bhalobasha kothay pao bolo to? 😂",
  "janu bolle aro taratari reply dibo 😏",
  "hmm bby, ami shunchi 🖤",
  "amake dakle ki chocolate diba? 🍫🙈",
  "tumi dakba ar ami ashbo na, ta ki hoy? 😽",
  "uff, abar amar kotha mone porlo? 🥺",
  "bolo jaan, mon diye shunchi 🥰"
];

    const randomReply = () =>
      replies[Math.floor(Math.random() * replies.length)];

    // ✅ exact trigger
    if (triggers.includes(lower)) {

      const reply = toBoldFont(randomReply());

      api.sendMessage(
        reply,
        event.threadID,
        (err, info) => {
          if (!err) {
            global.GoatBot.onReply.set(info.messageID, {
              commandName: "bot",
              author: event.senderID,
              text: reply
            });
          }
        },
        event.messageID
      );
      return;
    }

    // ✅ trigger + message
    for (const t of triggers) {
      if (lower.startsWith(t + " ")) {

        const userText = text.slice(t.length).trim();
        const reply = await chat(userText);

        api.sendMessage(
          reply,
          event.threadID,
          (err, info) => {
            if (!err) {
              global.GoatBot.onReply.set(info.messageID, {
                commandName: "bot",
                author: event.senderID,
                text: reply
              });
            }
          },
          event.messageID
        );

        return;
      }
    }

  } catch (e) {
    console.error("onChat error:", e);
  }
};