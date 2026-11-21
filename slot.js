const utils = require("../../utils.js");

const EMOJIS = ["🍒", "🍋", "🍉", "⭐", "💎"];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = {
  config: {
    name: "slot",
    aliases: ["slots"],
    version: "1.2",
    author: "Hoon",
    role: 0,
    category: "economy"
  },

  onStart: async function ({ api, message, event, args, usersData }) {
    const uid = event.senderID;
    const user = await usersData.get(uid) || {};
    const data = user.data || {};
    const name = user.name || "Unknown";

    /* ===== DAILY RESET LOGIC (30 LIMIT) ===== */
    const today = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Dhaka" });
    let slotCount = 0;
    if (data.slotLog && data.slotLog.date === today) {
      slotCount = Number(data.slotLog.count || 0);
    }

    if (slotCount >= 30) {
      return message.reply("❌ আপনি আজকে আপনার সর্বোচ্চ ৩০ বার খেলার লিমিট শেষ করে ফেলেছেন! আগামীকাল আবার খেলতে পারবেন।");
    }

    /* ===== COOLDOWN ===== */
    const now = Date.now();
    if (now - (data.lastSlotTime || 0) < 10_000) {
      return message.reply("⏳ Please wait before spinning again.");
    }

    /* ===== LOAD BALANCES (SAFE) ===== */
    let wallet = utils.safeBigInt(user.money);
    let bank = utils.safeBigInt(data.bank);

    /* ===== BET ===== */
    const bet = utils.parseAmount(args[0], "wallet", wallet, bank, 0n);
    if (!bet || typeof bet !== "bigint" || bet <= 0n) {
      return message.reply("❌ Invalid bet amount.");
    }
    if (wallet < bet) {
      return message.reply("❌ You don't have enough balance.");
    }

    slotCount += 1;

    /* ===== FINAL SYMBOLS (DECIDED FIRST) ===== */
    const spin = () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    const A = spin();
    const B = spin();
    const C = spin();

    let multiplier = 0n;
    let finalTitle = "💀 NO MATCH!";
    let resultLine = "";

    if (A === B && B === C) {
      multiplier = 5n;
      finalTitle = "💎 JACKPOT! 3 MATCH!";
    } else if (A === B || B === C || A === C) {
      multiplier = 2n;
      finalTitle = "✨ NICE! 2 MATCH!";
    }

    /* ===== BALANCE UPDATE ===== */
    let profit = -bet;
    if (multiplier > 0n) {
      profit = bet * multiplier;
      wallet += profit;
      resultLine = `💰 Win: +${utils.formatMoney(profit)}`;
    } else {
      wallet -= bet;
      resultLine = `💸 Loss: -${utils.formatMoney(bet)}`;
    }

    /* ===== AUTO BANK LIMIT (150DO SYSTEM) ===== */
    const fixed = utils.applyWalletLimit(wallet, bank);
    wallet = fixed.wallet;
    bank = fixed.bank;

    /* ===== SAFE SAVE USER ===== */
    await usersData.set(uid, {
      ...user,
      money: wallet.toString(),
      data: {
        ...data,
        bank: bank.toString(),
        lastSlotTime: now,
        slotLog: { date: today, count: slotCount },
        slotWin: (
          utils.safeBigInt(data.slotWin) +
          (profit > 0n ? profit : 0n)
        ).toString()
      }
    });

    const formatBoard = (symbols, heading) =>
      `🎰 ${symbols.join(" | ")}\n` +
      `${heading}\n\n` +
      `👤 Player: ${name}\n` +
      `📊 Today's Play: ${slotCount}/30\n` +
      `💵 Bet: ${utils.formatMoney(bet)}\n` +
      `💼 Wallet: ${utils.formatMoney(wallet)}\n` +
      `🏦 Bank: ${utils.formatMoney(bank)}`;

    /* ===== EDITS: FOLLOW THE WORKING CRASH COMMAND PATTERN ===== */
    const sent = await message.reply(
      formatBoard(["❓", "❓", "❓"], "✨ The wheel is spinning...")
    );
    if (!sent || !sent.messageID) return;

    // Like crash.js, trigger edits without awaiting the edit promise.
    // The delays allow each Instagram edit request to be sent in sequence.
    await sleep(350);
    api.editMessage(
      formatBoard([spin(), "❓", "❓"], "✨ Spinning...")
      , sent.messageID
    );

    await sleep(350);
    api.editMessage(
      formatBoard([spin(), spin(), "❓"], "✨ Almost there...")
      , sent.messageID
    );

    await sleep(400);
    api.editMessage(
      formatBoard([A, B, C], `${resultLine}\n\n${finalTitle}`),
      sent.messageID
    );
  }
};