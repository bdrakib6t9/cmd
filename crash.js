const utils = require("../../utils.js");
const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = {
  config: {
    name: "crash",
    aliases: ["rocket"],
    version: "3.2",
    author: "Rakib",
    role: 0,
    category: "economy"
  },

  onStart: async function ({ api, message, event, args, usersData }) {
    const uid = event.senderID;
    const user = await usersData.get(uid) || {};
    
    // লোনের কারণে ডাটা যেন নষ্ট না হয়, তাই আগের সব ডাটা সুরক্ষিত রাখা হলো
    const currentData = user.data || {}; 
    const name = user.name || "Unknown";
    const isVIP = currentData.vip === true;

    /* ===== DAILY RESET LOGIC (30 LIMIT) ===== */
    const today = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Dhaka" }); // বাংলাদেশের সময় অনুযায়ী ডেট ট্র্যাকিং
    let crashCount = 0;

    // যদি আজকের দিনটি আগে সেভ করা দিনের সাথে মিলে, তবে আগের কাউন্ট নিবে, নাহলে নতুন দিন হিসেবে ০ হয়ে যাবে
    if (currentData.crashLog && currentData.crashLog.date === today) {
      crashCount = Number(currentData.crashLog.count || 0);
    }

    if (crashCount >= 30) {
      return message.reply("❌ আপনি আজকে আপনার সর্বোচ্চ ৩০ বার খেলার লিমিট শেষ করে ফেলেছেন! আগামীকাল আবার খেলতে পারবেন।");
    }

    /* ===== COOLDOWN ===== */
    const now = Date.now();
    if (now - (currentData.lastCrash || 0) < 10_000)
      return message.reply("⏳ Please wait before playing again.");

    /* ===== LOAD BALANCES (SAFE) ===== */
    let wallet = utils.safeBigInt(user.money);
    let bank   = utils.safeBigInt(currentData.bank);

    /* ===== BET & CASHOUT ===== */
    const bet = utils.parseAmount(
      args[0],
      "wallet",
      wallet,
      bank,
      0n
    );

    const cashout = Number(args[1]);

    if (!bet || typeof bet !== "bigint" || bet <= 0n || isNaN(cashout) || cashout < 1.1)
      return message.reply("❌ crash <bet> <cashout>");

    if (wallet < bet)
      return message.reply("❌ Not enough balance.");

    // লিমিট ১ বাড়ানো হলো
    crashCount += 1;

    /* ===== CRASH POINT ===== */
    const crashPoint =
      Math.max(
        1.0,
        (Math.random() * 6 + 1) *
        (Math.random() < 0.08 ? 2.5 : 1)
      );

    const sent = await message.reply("🚀 Launching...");

    /* ===== EDIT 1 ===== */
    await sleep(350);
    api.editMessage(
      `🚀 CRASH GAME\n\n👤 Player: ${name}\n📊 Today's Play: ${crashCount}/30\n💥 Multiplier: 1.35x`,
      sent.messageID
    );

    /* ===== EDIT 2 ===== */
    await sleep(350);
    api.editMessage(
      `🚀 CRASH GAME\n\n👤 Player: ${name}\n📊 Today's Play: ${crashCount}/30\n💥 Multiplier: 1.82x`,
      sent.messageID
    );

    /* ===== EDIT 3 ===== */
    await sleep(350);
    api.editMessage(
      `🚀 CRASH GAME\n\n👤 Player: ${name}\n📊 Today's Play: ${crashCount}/30\n💥 Multiplier: 2.24x`,
      sent.messageID
    );

    /* ===== RESULT ===== */
    let profit = -bet;
    let resultText = "";

    const crashStats = currentData.crashStats || { win: "0", lose: "0" };

    if (cashout < crashPoint) {
      const vipBonus = isVIP ? 125n : 100n; // 25% VIP
      const win =
        (bet * BigInt(Math.floor(cashout * 100)) * vipBonus) /
        100n / 100n;

      wallet += win;
      profit = win;

      crashStats.win =
        (utils.safeBigInt(crashStats.win) + win).toString();

      resultText =
        `🎉 CASHED OUT at ${cashout.toFixed(2)}x\n` +
        (isVIP ? "👑 VIP Bonus: +25%\n" : "");
    }
    else {
      wallet -= bet;

      crashStats.lose =
        (utils.safeBigInt(crashStats.lose) + bet).toString();

      resultText =
        `💀 CRASHED at ${crashPoint.toFixed(2)}x`;
    }

    /* ===== AUTO BANK LIMIT (150cs) ===== */
    const fixed = utils.applyWalletLimit(wallet, bank);
    wallet = fixed.wallet;
    bank   = fixed.bank;

    /* ===== SAFE SAVE (রিসেট প্রবলেম ফিক্স) ===== */
    // এখানে ...user এবং ...currentData ব্যবহার করার কারণে লোন বা টাকা অ্যাড করলেও ডাটা ডিলিট হবে না
    await usersData.set(uid, {
      ...user,
      money: wallet.toString(),
      data: {
        ...currentData,
        bank: bank.toString(),
        lastCrash: now,
        crashLog: {
          date: today,
          count: crashCount
        },
        crashStats
      }
    });

    /* ===== FINAL EDIT (4) ===== */
    await sleep(400);
    api.editMessage(
      `🚀 CRASH RESULT\n\n` +
      `👤 Player: ${name}\n` +
      `📊 Today's Play: ${crashCount}/30\n` +
      `💥 Final Multiplier: ${Math.min(cashout, crashPoint).toFixed(2)}x\n\n` +
      `${resultText}\n` +
      `💵 Bet: ${utils.formatMoney(bet)}\n` +
      (profit > 0n
        ? `💰 Win: +${utils.formatMoney(profit)}\n`
        : `💸 Loss: -${utils.formatMoney(-profit)}\n`) +
      `💼 Wallet: ${utils.formatMoney(wallet)}\n` +
      `🏦 Bank: ${utils.formatMoney(bank)}`,
      sent.messageID
    );
  }
};
