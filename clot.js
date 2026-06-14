module.exports = {
    config: {
        name: "clot",
        version: "1.0.0",
        author: "Rakib", // আপনার নাম দিতে পারেন
        countDown: 5, // প্রতি ৫ সেকেন্ড পর পর খেলা যাবে
        role: 0, // সবাই খেলতে পারবে
        description: "কয়েন বাজি ধরে স্লট মেশিন খেলুন।",
        category: "game",
        guide: {
            en: "{pn} [amount/all]\nExample: {pn} 500 or {pn} all",
            bn: "{pn} [টাকার পরিমাণ/all]\nউদাহরণ: {pn} 500 অথবা {pn} all"
        }
    },

    onStart: async function ({ api, event, args, usersData }) {
        const { senderID, threadID, messageID } = event;

        // ১. ইউজারের ব্যালেন্স চেক করা
        const userData = await usersData.get(senderID);
        let userMoney = userData.money || 0;

        const input = args[0];
        if (!input) {
            return api.sendMessage("⚠️ দয়া করে বাজির পরিমাণ লিখুন! যেমন: slot 500 অথবা slot all", threadID, messageID);
        }

        let betAmount;
        if (input.toLowerCase() === "all") {
            betAmount = userMoney;
        } else {
            betAmount = parseInt(input);
        }

        // ২. বাজি ধরার বিভিন্ন শর্ত চেক করা
        if (isNaN(betAmount) || betAmount <= 0) {
            return api.sendMessage("⚠️ বাজির পরিমাণ অবশ্যই একটি সঠিক সংখ্যা হতে হবে!", threadID, messageID);
        }

        if (betAmount < 50) {
            return api.sendMessage("⚠️ সর্বনিম্ন ৫০ কয়েন বাজি ধরতে হবে!", threadID, messageID);
        }

        if (betAmount > userMoney) {
            return api.sendMessage(`⚠️ আপনার কাছে পর্যাপ্ত কয়েন নেই! আপনার বর্তমান ব্যালেন্স: ${userMoney} coins`, threadID, messageID);
        }

        // ৩. স্লট আইটেম এবং স্পিন লজিক
        const items = ["🍎", "🍌", "🍒", "🍇", "🍉", "7️⃣"];
        const slot1 = items[Math.floor(Math.random() * items.length)];
        const slot2 = items[Math.floor(Math.random() * items.length)];
        const slot3 = items[Math.floor(Math.random() * items.length)];

        let win = false;
        let prize = 0;
        let statusMessage = "";

        // ৩টি একই হলে জ্যাকপট (৫ গুণ লাভ)
        if (slot1 === slot2 && slot2 === slot3) {
            win = true;
            let multiplier = slot1 === "7️⃣" ? 10 : 5; // যদি তিনটিই 7️⃣ হয় তবে ১০ গুণ, নাহলে ৫ গুণ
            prize = betAmount * multiplier;
            statusMessage = `🎉 JACKPOT!!! আপনি মেলাতে পেরেছেন!`;
        } 
        // ২টি একই হলে সাধারণ জয় (২ গুণ লাভ)
        else if (slot1 === slot2 || slot1 === slot3 || slot2 === slot3) {
            win = true;
            prize = betAmount * 2;
            statusMessage = `🥳 দারুণ! ২টি মিলে গেছে!`;
        } 
        // কোনোটি না মিললে পরাজয়
        else {
            win = false;
            prize = betAmount;
            statusMessage = `😢 ইশ! একটিও মিললো না।`;
        }

        // ৪. ব্যালেন্স আপডেট ও মেসেজ পাঠানো
        if (win) {
            const newBalance = userMoney + prize;
            await usersData.set(senderID, { money: newBalance });

            return api.sendMessage(
                `🎰 [ SLOT MACHINE ] 🎰\n` +
                `-------------------\n` +
                `|  ${slot1}  |  ${slot2}  |  ${slot3}  |\n` +
                `-------------------\n` +
                `${statusMessage}\n\n` +
                `➕ আপনি জিতেছেন: ${prize} coins 💰\n` +
                `💳 বর্তমান ব্যালেন্স: ${newBalance} coins`,
                threadID, messageID
            );
        } else {
            const newBalance = userMoney - prize;
            await usersData.set(senderID, { money: newBalance });

            return api.sendMessage(
                `🎰 [ SLOT MACHINE ] 🎰\n` +
                `-------------------\n` +
                `|  ${slot1}  |  ${slot2}  |  ${slot3}  |\n` +
                `-------------------\n` +
                `${statusMessage}\n\n` +
                `➖ আপনি হেরেছেন: -${prize} coins 💸\n` +
                `💳 বর্তমান ব্যালেন্স: ${newBalance} coins`,
                threadID, messageID
            );
        }
    }
};
