const utils = require("../../utils.js");

module.exports = {
  config: {
    name: "bank",
    aliases: ["vault"],
    version: "5.3",
    author: "Rakib",
    role: 0,
    category: "economy"
  },

  langs: {
    en: {
      status: "💳 Your balance:\n💼 Wallet: %1\n🏦 Bank: %2\n💸 Loan: %3",
      invalidAmount: "❌ Invalid amount",
      notEnoughWallet: "❌ Not enough wallet balance",
      notEnoughBank: "❌ Not enough bank balance",
      loanLimit: "❌ Loan limit exceeded",
      noLoan: "❌ No active loan"
    }
  },

  onStart: async function ({ message, event, args, usersData, getLang }) {
    const uid = event.senderID;
    
    // ডাটাবেজ থেকে একদম লেটেস্ট ডাটা রিড করা হচ্ছে
    const user = await usersData.get(uid) || {};
    
    // ডিপ ক্লোন করে ডাটা সম্পূর্ণ আলাদা করা হলো যাতে ক্র্যাশের ডাটা ডিলিট না হয়
    const userData = user.data ? JSON.parse(JSON.stringify(user.data)) : {};

    let wallet = BigInt(user.money || 0);
    let bank = BigInt(userData.bank || 0);
    let loan = BigInt(userData.loan || 0);

    // ===== SAFE SAVE FUNCTION =====
    const save = async () => {
      userData.bank = bank.toString();
      userData.loan = loan.toString();
      
      await usersData.set(uid, {
        ...user,
        money: wallet.toString(),
        data: userData // এখানে আগের ক্র্যাশ ডাটা সহ পুরো অবজেক্ট সেভ হচ্ছে
      });
    };

    const LOAN_LIMIT = 10_000_000n;

    if (!args[0]) {
      return message.reply(getLang("status", utils.formatMoney(wallet), utils.formatMoney(bank), utils.formatMoney(loan)));
    }

    const sub = args[0].toLowerCase();
    const mode = sub === "withdraw" ? "bank" : sub === "repay" || sub === "pay" ? "loan" : "wallet";
    const amt = utils.parseAmount(args[1], mode, wallet, bank, loan);

    if (amt === null || typeof amt !== "bigint" || amt <= 0n)
      return message.reply(getLang("invalidAmount"));

    // ===== DEPOSIT =====
    if (sub === "deposit" || sub === "dep") {
      if (wallet < amt) return message.reply(getLang("notEnoughWallet"));
      wallet -= amt;
      bank += amt;
      await save();
    }

    // ===== WITHDRAW =====
    else if (sub === "withdraw" || sub === "with") {
      if (bank <= 0n) return message.reply(getLang("notEnoughBank"));
      let reqAmt = (!args[1] || args[1].toLowerCase() === "all") ? bank : utils.parseAmount(args[1], "bank", wallet, bank, loan);
      
      if (!reqAmt || typeof reqAmt !== "bigint" || reqAmt <= 0n) return message.reply(getLang("invalidAmount"));

      const actual = reqAmt > bank ? bank : reqAmt;
      wallet += actual;
      bank -= actual;

      ({ wallet, bank } = utils.applyWalletLimit(wallet, bank));
      await save();
    }

    // ===== LOAN =====
    else if (sub === "loan") {
      if (loan > 0n) return message.reply("❌ You already have an active loan. Repay it first.");
      if (amt > LOAN_LIMIT) return message.reply("❌ Maximum loan limit is 10,000,000");

      loan += amt;
      wallet += amt;
      await save();
    }

    // ===== REPAY =====
    else if (sub === "repay" || sub === "pay") {
      if (loan <= 0n) return message.reply(getLang("noLoan"));
      const pay = amt > loan ? loan : amt;
      if (wallet < pay) return message.reply(getLang("notEnoughWallet"));

      wallet -= pay;
      loan -= pay;
      await save();
    } else {
      return message.reply(getLang("invalidAmount"));
    }

    return message.reply(getLang("status", utils.formatMoney(wallet), utils.formatMoney(bank), utils.formatMoney(loan)));
  }
};
