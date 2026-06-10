const utils = require("../../utils.js");

module.exports = {
  config: {
    name: "bank",
    aliases: ["vault"],
    version: "5.2",
    author: "Rakib",
    role: 0,
    category: "economy"
  },

  langs: {
    en: {
      status:
        "💳 Your balance:\n" +
        "💼 Wallet: %1\n" +
        "🏦 Bank: %2\n" +
        "💸 Loan: %3",

      invalidAmount: "❌ Invalid amount",
      notEnoughWallet: "❌ Not enough wallet balance",
      notEnoughBank: "❌ Not enough bank balance",
      loanLimit: "❌ Loan limit exceeded",
      noLoan: "❌ No active loan",

      walletFull:
        "⚠️ Wallet balance limit (150cs) is already full.\n" +
        "🏦 Your money is safe in the bank.",

      walletLimitHit:
        "⚠️ Wallet balance limit reached!\n" +
        "💼 Withdrawn: %1\n" +
        "🏦 Remaining amount stayed in bank."
    }
  },

  onStart: async function ({ message, event, args, usersData, getLang }) {
    const uid = event.senderID;
    const user = await usersData.get(uid) || {};

    // ===== LOAD DATA (BigInt SAFE) =====
    let wallet = BigInt(user.money || 0);
    let bank = BigInt(user.data?.bank || 0);
    let loan = BigInt(user.data?.loan || 0);

    // ===== SAFE SAVE (রিসেট প্রবলেম ফিক্সড) =====
    const save = async () => {
      await usersData.set(uid, {
        ...user, // ইউজারের আগের নাম বা অন্যান্য মেইন ডাটা সুরক্ষিত রাখবে
        money: wallet.toString(),
        data: {
          ...(user.data || {}), // ক্র্যাশ গেমের ডাটা ও অন্যান্য আগের ডাটা সুরক্ষিত রাখবে
          bank: bank.toString(),
          loan: loan.toString()
        }
      });
    };

    const LOAN_LIMIT = 10_000_000n; // 10M limit
    const WALLET_LIMIT = 150n; // wallet cap

    // ===== SHOW STATUS =====
    if (!args[0]) {
      return message.reply(
        getLang(
          "status",
          utils.formatMoney(wallet),
          utils.formatMoney(bank),
          utils.formatMoney(loan)
        )
      );
    }

    const sub = args[0].toLowerCase();

    // ===== DETERMINE MODE =====
    const mode =
      sub === "withdraw" ? "bank" :
      sub === "repay" || sub === "pay" ? "loan" :
      "wallet";

    // ===== PARSE AMOUNT =====
    const amt = utils.parseAmount(args[1], mode, wallet, bank, loan);

    if (amt === null || typeof amt !== "bigint" || amt <= 0n)
      return message.reply(getLang("invalidAmount"));

    // ===== DEPOSIT =====
    if (sub === "deposit" || sub === "dep") {
      if (wallet < amt)
        return message.reply(getLang("notEnoughWallet"));

      wallet -= amt;
      bank += amt;
      await save();
    }

    // ===== WITHDRAW =====
    else if (sub === "withdraw" || sub === "with") {
      if (bank <= 0n)
        return message.reply(getLang("notEnoughBank"));

      let reqAmt;
      if (!args[1] || args[1].toLowerCase() === "all") {
        reqAmt = bank;
      } else {
        reqAmt = utils.parseAmount(args[1], "bank", wallet, bank, loan);
      }

      if (!reqAmt || typeof reqAmt !== "bigint" || reqAmt <= 0n)
        return message.reply(getLang("invalidAmount"));

      // 1️⃣ raw withdraw
      const actual = reqAmt > bank ? bank : reqAmt;
      wallet += actual;
      bank -= actual;

      // 2️⃣ GLOBAL wallet cap (150cs auto bank)
      ({ wallet, bank } = utils.applyWalletLimit(wallet, bank));

      await save();
    }

    // ===== LOAN =====
    else if (sub === "loan") {
      // already has loan
      if (loan > 0n)
        return message.reply("❌ You already have an active loan. Repay it first.");

      // limit check
      if (amt > LOAN_LIMIT)
        return message.reply("❌ Maximum loan limit is 10,000,000");

      loan += amt;
      wallet += amt;
      await save();
    }

    // ===== REPAY =====
    else if (sub === "repay" || sub === "pay") {
      if (loan <= 0n)
        return message.reply(getLang("noLoan"));

      const pay = amt > loan ? loan : amt;
      if (wallet < pay)
        return message.reply(getLang("notEnoughWallet"));

      wallet -= pay;
      loan -= pay;
      await save();
    }

    else {
      return message.reply(getLang("invalidAmount"));
    }

    // ===== FINAL STATUS =====
    return message.reply(
      getLang(
        "status",
        utils.formatMoney(wallet),
        utils.formatMoney(bank),
        utils.formatMoney(loan)
      )
    );
  }
};
