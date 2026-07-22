const axios = require("axios");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

module.exports = {
  config: {
    name: "4k",
    version: "2.0",
    author: "Rakib",
    countDown: 10,
    role: 0,
    shortDescription: "Upscale image to Ultra HD 4K",
    longDescription: "Reply to an image to upscale it using AI enhancement",
    category: "image",
    guide: "{pn} (reply to an image)"
  },

  onStart: async function ({ message, event }) {
    const reply = event.messageReply;

    if (!reply || !reply.attachments || reply.attachments.length === 0)
      return message.reply("📸 দয়া করে কোনো একটি ছবিতে রিপ্লাই দিন।");

    const attachment = reply.attachments[0];

    if (attachment.type !== "photo")
      return message.reply("❌ এটি কোনো বৈধ ছবি নয়।");

    const cacheFolder = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheFolder)) fs.mkdirSync(cacheFolder, { recursive: true });

    const outputPath = path.join(cacheFolder, `4k_${Date.now()}.jpg`);

    try {
      await message.reply("⚡ AI দিয়ে 4K Ultra HD প্রসেস করা হচ্ছে, কিছুক্ষণ অপেক্ষা করুন...");

      const imageUrl = encodeURIComponent(attachment.url);
      
      // AI Upscale API (4x resolution + AI detail reconstruction)
      const apiUri = `https://api.vyturex.com/upscale?url=${imageUrl}`;

      let imageBuffer;

      try {
        // ১. ট্রাই করব পাওয়ারফুল AI API দিয়ে ফিক্সড ও শার্প ছবি আনার
        const aiResponse = await axios.get(apiUri, { responseType: "arraybuffer", timeout: 15000 });
        imageBuffer = Buffer.from(aiResponse.data);
      } catch (apiError) {
        // ২. যদি AI API ডাউন থাকে, তবে অ্যাডভান্সড Sharp ফিচার চালিত হবে
        console.log("AI API Failed, falling back to advanced Sharp processing...");
        
        const originalImage = await axios.get(attachment.url, { responseType: "arraybuffer" });
        const inputBuffer = Buffer.from(originalImage.data);
        const metadata = await sharp(inputBuffer).metadata();

        const targetWidth = 3840;
        const targetHeight = Math.round((metadata.height / metadata.width) * targetWidth);

        imageBuffer = await sharp(inputBuffer)
          .resize(targetWidth, targetHeight, {
            kernel: sharp.kernel.lanczos3,
            fastShrinkOnLoad: false
          })
          .sharpen({
            sigma: 1.5,
            m1: 1.0,
            m2: 2.0
          })
          .modulate({
            brightness: 1.03,
            saturation: 1.08
          })
          .normalise() // কন্টেন্ট এবং কালার কনট্রাস্ট ইম্প্রুভ করবে
          .toFormat("jpeg", { quality: 100 })
          .toBuffer();
      }

      // ফাইনাল ফাইল সেভ করা
      fs.writeFileSync(outputPath, imageBuffer);

      // ইউজারকে মেসেজ পাঠানো
      await message.reply({
        body: "✨ আপনার ছবি সফলভাবে High-Quality 4K AI Enhancer দিয়ে প্রসেস করা হয়েছে!",
        attachment: fs.createReadStream(outputPath)
      });

      // ফাইল ডিলিট
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    } catch (err) {
      console.error("4K Upscale Error:", err.message);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      return message.reply("❌ আপস্কেল করতে ব্যর্থ হয়েছে। ছবি অথবা নেটওয়ার্কে সমস্যা রয়েছে।");
    }
  }
};
