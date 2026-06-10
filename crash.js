const utils = require("../../utils.js");
const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = {
  config: {
    name: "crash",
    aliases: ["rocket"],
    version: "1.0",
    author: "Rakib",
    role: 0,
    category: "economy"
  },

  onStart: async function ({ api, message, event, args, usersData }) {
    const uid = event.senderID;
    
    // ডাটাবেজ থেকে একদম লেটেস্ট ডাটা রিড করা হচ্ছে
    const user = await usersData.get(uid) || {};
    const name = user.name || "Unknown";
    
    // ডিপ ক্লোন করে ডাটা সম্পূর্ণ আলাদা করা হলো যাতে ওভাররাইট না হয়
    const userData = user.data ? JSON.parse(JSON.stringify(user.data)) : {};
    const isVIP = userData.vip === true;

    /* ===== DAILY RESET LOGIC (30 LIMIT) ===== */
    const today = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Dhaka" });
    let crashCount = 0;

    if (userData.crashLog && userData.crashLog.date === today) {
      crashCount = Number(userData.crashLog.count || 0);
    }

    if (crashCount >= 30) {
      return message.reply("❌ আপনি আজকে আপনার সর্বোচ্চ ৩০ বার খেলার লিমিট শেষ করে ফেলেছেন! আগামীকাল আবার খেলতে পারবেন।");
    }

    /* ===== COOLDOWN ===== */
    const now = Date.now();
    if (now - (userData.lastCrash || 0) < 10_000)
      return message.reply("⏳ Please wait before playing again.");

    /* ===== LOAD BALANCES (SAFE) ===== */
    let wallet = utils.safeBigInt(user.money);
    let bank   = utils.safeBigInt(userData.bank);

    /* ===== BET & CASHOUT ===== */
    const bet = utils.parseAmount(args[0], "wallet", wallet, bank, 0n);
    const cashout = Number(args[1]);

    if (!bet || typeof bet !== "bigint" || bet <= 0n || isNaN(cashout) || cashout < 1.1)
      return message.reply("❌ crash <bet> <cashout>");

    if (wallet < bet)
      return message.reply("❌ Not enough balance.");

    // লিমিট বাড়ানো হলো
    crashCount += 1;

    /* ===== CRASH POINT ===== */
    const crashPoint = Math.max(1.0, (Math.random() * 6 + 1) * (Math.random() < 0.08 ? 2.5 : 1));
    const sent = await message.reply("🚀 Launching...");

    /* ===== EDITS ===== */
    await sleep(350);
    api.editMessage(`🚀 CRASH GAME\n\n👤 Player: ${name}\n📊 Today's Play: ${crashCount}/30\n💥 Multiplier: 1.35x`, sent.messageID);
    await sleep(350);
    api.editMessage(`🚀 CRASH GAME\n\n👤 Player: ${name}\n📊 Today's Play: ${crashCount}/30\n💥 Multiplier: 1.82x`, sent.messageID);
    await sleep(350);
    api.editMessage(`🚀 CRASH GAME\n\n👤 Player: ${name}\n📊 Today's Play: ${crashCount}/30\n💥 Multiplier: 2.24x`, sent.messageID);

    /* ===== RESULT ===== */
    let profit = -bet;
    let resultText = "";
    const crashStats = userData.crashStats || { win: "0", lose: "0" };

    if (cashout < crashPoint) {
      const vipBonus = isVIP ? 125n : 100n;
      const win = (bet * BigInt(Math.floor(cashout * 100)) * vipBonus) / 100n / 100n;
      wallet += win;
      profit = win;
      crashStats.win = (utils.safeBigInt(crashStats.win) + win).toString();
      resultText = `🎉 CASHED OUT at ${cashout.toFixed(2)}x\n` + (isVIP ? "👑 VIP Bonus: +25%\n" : "");
    } else {
      wallet -= bet;
      crashStats.lose = (utils.safeBigInt(crashStats.lose) + bet).toString();
      resultText = `💀 CRASHED at ${crashPoint.toFixed(2)}x`;
    }

    /* ===== AUTO BANK LIMIT ===== */
    const fixed = utils.applyWalletLimit(wallet, bank);
    wallet = fixed.wallet;
    bank   = fixed.bank;

    // নতুন ডেটা অবজেক্ট তৈরি
    userData.bank = bank.toString();
    userData.lastCrash = now;
    userData.crashLog = { date: today, count: crashCount };
    userData.crashStats = crashStats;

    /* ===== SAFE SAVE ===== */
    await usersData.set(uid, {
      ...user,
      money: wallet.toString(),
      data: userData
    });

    /* ===== FINAL EDIT ===== */
    await sleep(400);
    api.editMessage(
      `🚀 CRASH RESULT\n\n` +
      `👤 Player: ${name}\n` +
      `📊 Today's Play: ${crashCount}/30\n` +
      `💥 Final Multiplier: ${Math.min(cashout, crashPoint).toFixed(2)}x\n\n` +
      `${resultText}\n` +
      `💵 Bet: ${utils.formatMoney(bet)}\n` +
      (profit > 0n ? `💰 Win: +${utils.formatMoney(profit)}\n` : `💸 Loss: -${utils.formatMoney(-profit)}\n`) +
      `💼 Wallet: ${utils.formatMoney(wallet)}\n` +
      `🏦 Bank: ${utils.formatMoney(bank)}`,
      sent.messageID
    );
  }
};
