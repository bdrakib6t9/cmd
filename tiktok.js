const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const CONFIG_URL =
  "https://raw.githubusercontent.com/bdrakib6t9/HOON/main/apiUrl.json";

const CACHE_DIR = path.join(__dirname, "cache");

module.exports = {
  config: {
    name: "tiktok",
    aliases: ["tik"],
    version: "4.0",
    author: "Hoon",
    countDown: 5,
    role: 0,
    shortDescription: "Search and download TikTok videos",
    longDescription:
      "Search TikTok videos by keyword and download selected video.",
    category: "media",
    guide: {
      en: "{pn} <keyword>"
    }
  },

  onStart: async function ({ api, event, args }) {
    const { threadID, messageID } = event;

    if (!args.length) {
      return api.sendMessage(
        "❌ | একটি TikTok search keyword দাও।\n\nExample:\n/tiktok anime edit",
        threadID,
        messageID
      );
    }

    const query = args.join(" ").trim();

    try {
      // =========================
      // Load API config
      // =========================

      const configResponse = await axios.get(CONFIG_URL, {
        timeout: 30000
      });

      const config = configResponse.data || {};

      let baseUrl =
        config.tik ||
        config.tiktok ||
        config.tiktokApi ||
        config.tikTokApi ||
        "https://rakib-tik-api2.onrender.com";

      baseUrl = String(baseUrl).replace(/\/+$/, "");

      console.log(`[TikTok] API: ${baseUrl}`);

      // =========================
      // Search TikTok
      // =========================

      const searchResponse = await axios.post(
        `${baseUrl}/search`,
        {
          type: "keyword",
          query,
          limit: 10,
          cursor: 0,
          fan_out: 1
        },
        {
          timeout: 120000,
          headers: {
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36",
            Accept: "application/json"
          }
        }
      );

      const searchData = searchResponse.data;

      console.log(
        "[TikTok] Search response:",
        JSON.stringify(searchData).slice(0, 3000)
      );

      // =========================
      // Find result array
      // =========================

      let rawVideos = [];

      if (Array.isArray(searchData)) {
        rawVideos = searchData;
      } else if (Array.isArray(searchData?.data)) {
        rawVideos = searchData.data;
      } else if (Array.isArray(searchData?.results)) {
        rawVideos = searchData.results;
      } else if (Array.isArray(searchData?.videos)) {
        rawVideos = searchData.videos;
      } else if (Array.isArray(searchData?.data?.videos)) {
        rawVideos = searchData.data.videos;
      } else if (Array.isArray(searchData?.result)) {
        rawVideos = searchData.result;
      } else if (Array.isArray(searchData?.result?.videos)) {
        rawVideos = searchData.result.videos;
      }

      if (!rawVideos.length) {
        return api.sendMessage(
          `❌ | "${query}" এর জন্য কোনো TikTok ভিডিও পাওয়া যায়নি।`,
          threadID,
          messageID
        );
      }

      // =========================
      // Normalize results
      // =========================

      const videos = rawVideos
        .map((item, index) => {
          const data = item?.data || item?.video || item;

          const id =
            data?.id ||
            data?.video_id ||
            data?.aweme_id ||
            data?.item_id ||
            data?.video?.id ||
            "";

          const author =
            data?.author?.unique_id ||
            data?.author?.uniqueId ||
            data?.author?.username ||
            data?.author?.unique_id ||
            data?.author ||
            data?.username ||
            data?.user?.unique_id ||
            data?.user?.username ||
            "";

          const title =
            data?.title ||
            data?.desc ||
            data?.description ||
            data?.video?.title ||
            "TikTok Video";

          const thumbnail =
            data?.thumbnail ||
            data?.cover ||
            data?.origin_cover ||
            data?.dynamic_cover ||
            data?.video?.cover ||
            "";

          const region =
            data?.region ||
            data?.location ||
            "";

          const stats = data?.stats || data?.statistics || {};

          const views =
            data?.views ||
            data?.playCount ||
            data?.play_count ||
            stats?.playCount ||
            stats?.play_count ||
            0;

          const likes =
            data?.likes ||
            data?.diggCount ||
            data?.digg_count ||
            stats?.diggCount ||
            stats?.digg_count ||
            0;

          const comments =
            data?.comments ||
            data?.commentCount ||
            data?.comment_count ||
            stats?.commentCount ||
            stats?.comment_count ||
            0;

          const shares =
            data?.shares ||
            data?.shareCount ||
            data?.share_count ||
            stats?.shareCount ||
            stats?.share_count ||
            0;

          return {
            index: index + 1,
            id: String(id),
            author: String(author || "unknown"),
            title: String(title || "TikTok Video"),
            thumbnail: String(thumbnail || ""),
            region: String(region || ""),
            views,
            likes,
            comments,
            shares
          };
        })
        .filter(video => video.id);

      if (!videos.length) {
        return api.sendMessage(
          "❌ | Search result পাওয়া গেছে, কিন্তু valid video ID পাওয়া যায়নি।",
          threadID,
          messageID
        );
      }

      // Maximum 10
      const finalVideos = videos.slice(0, 10);

      // =========================
      // Build result text
      // =========================

      let message =
        `🎵 𝗧𝗶𝗸𝗧𝗼𝗸 𝗦𝗲𝗮𝗿𝗰𝗵\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🔎 Query: ${query}\n` +
        `📌 Results: ${finalVideos.length}\n\n`;

      finalVideos.forEach((video, i) => {
        message +=
          `【${i + 1}】 ${video.title.slice(0, 100)}\n` +
          `👤 ${video.author}\n` +
          `👁️ ${formatNumber(video.views)}   ` +
          `❤️ ${formatNumber(video.likes)}\n` +
          `💬 ${formatNumber(video.comments)}   ` +
          `🔁 ${formatNumber(video.shares)}\n\n`;
      });

      message +=
        `━━━━━━━━━━━━━━━━━━\n` +
        `💬 Reply with a number (1-${finalVideos.length}) to download.`;

      // =========================
      // Download thumbnails
      // =========================

      const attachments = [];

      await fs.ensureDir(CACHE_DIR);

      for (let i = 0; i < finalVideos.length; i++) {
        const video = finalVideos[i];

        if (!video.thumbnail) continue;

        try {
          const imageResponse = await axios.get(video.thumbnail, {
            responseType: "arraybuffer",
            timeout: 30000,
            maxContentLength: 10 * 1024 * 1024,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36",
              Referer: "https://www.tiktok.com/"
            }
          });

          const imagePath = path.join(
            CACHE_DIR,
            `tik_thumb_${Date.now()}_${i}.jpg`
          );

          await fs.writeFile(imagePath, Buffer.from(imageResponse.data));

          attachments.push(fs.createReadStream(imagePath));

          // Delete thumbnail later
          setTimeout(async () => {
            try {
              await fs.remove(imagePath);
            } catch {}
          }, 120000);
        } catch (err) {
          console.log(
            `[TikTok] Thumbnail ${i + 1} failed:`,
            err.message
          );
        }
      }

      // =========================
      // Save reply data
      // =========================

      global.GoatBot.onReply.set(messageID, {
        commandName: "tiktok",
        author: event.senderID,
        threadID,
        baseUrl,
        videos: finalVideos
      });

      // =========================
      // Send results
      // =========================

      return api.sendMessage(
        {
          body: message,
          attachment: attachments.length ? attachments : undefined
        },
        threadID,
        messageID
      );
    } catch (error) {
      console.error(
        "[TikTok] Search Error:",
        error?.response?.data || error
      );

      return api.sendMessage(
        `❌ | TikTok search failed.\n\n${getErrorMessage(error)}`,
        threadID,
        messageID
      );
    }
  },

  // ==========================================================
  // ON REPLY
  // ==========================================================

  onReply: async function ({ api, event, Reply }) {
    const { threadID, messageID, body } = event;

    // Only original user can select
    if (String(Reply.author) !== String(event.senderID)) {
      return;
    }

    const input = String(body || "").trim();

    if (!/^\d+$/.test(input)) {
      return api.sendMessage(
        `❌ | শুধু একটি সংখ্যা দাও।\n\nExample: 1`,
        threadID,
        messageID
      );
    }

    const index = parseInt(input, 10) - 1;

    if (
      index < 0 ||
      index >= Reply.videos.length
    ) {
      return api.sendMessage(
        `❌ | 1 থেকে ${Reply.videos.length} এর মধ্যে একটি সংখ্যা দাও।`,
        threadID,
        messageID
      );
    }

    const video = Reply.videos[index];

    try {
      // =========================
      // TikTok URL
      // =========================

      const tiktokUrl =
        `https://www.tiktok.com/@${encodeURIComponent(
          video.author
        )}/video/${video.id}`;

      console.log(`[TikTok] Selected: ${tiktokUrl}`);

      // =========================
      // Download API
      // =========================

      const downloadApi =
        `${Reply.baseUrl}/download?url=${encodeURIComponent(
          tiktokUrl
        )}`;

      console.log(`[TikTok] Download API: ${downloadApi}`);

      await api.sendMessage(
        `⏳ | ভিডিও ডাউনলোড হচ্ছে...\n\n` +
        `🎬 ${video.title.slice(0, 150)}\n` +
        `👤 ${video.author}\n\n` +
        `Please wait...`,
        threadID,
        messageID
      );

      // =========================
      // Download MP4 from API
      // =========================

      const response = await axios.get(downloadApi, {
        responseType: "arraybuffer",

        timeout: 300000,

        maxContentLength: Infinity,
        maxBodyLength: Infinity,

        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36",

          Accept: "video/mp4,application/octet-stream,*/*"
        }
      });

      const contentType =
        response.headers["content-type"] ||
        "";

      const buffer = Buffer.from(response.data);

      console.log(
        `[TikTok] Content-Type: ${contentType}`
      );

      console.log(
        `[TikTok] Downloaded: ${(
          buffer.length /
          1024 /
          1024
        ).toFixed(2)} MB`
      );

      // =========================
      // Check API response
      // =========================

      if (!contentType.toLowerCase().includes("video/mp4")) {
        let errorText = "";

        try {
          const text = buffer.toString("utf8");

          try {
            const json = JSON.parse(text);

            errorText =
              json.detail ||
              json.message ||
              json.error ||
              JSON.stringify(json, null, 2);
          } catch {
            errorText = text.slice(0, 1500);
          }
        } catch {
          errorText = "Unknown API response";
        }

        throw new Error(
          `Download API MP4 দেয়নি.\n\n` +
          `Content-Type: ${contentType}\n\n` +
          errorText
        );
      }

      // =========================
      // Validate MP4
      // =========================

      if (!buffer || buffer.length < 10000) {
        throw new Error(
          "Downloaded video file is too small or empty."
        );
      }

      // =========================
      // Save MP4
      // =========================

      await fs.ensureDir(CACHE_DIR);

      const safeId = String(video.id).replace(
        /[^a-zA-Z0-9_-]/g,
        ""
      );

      const fileName =
        `tiktok_${safeId}_${Date.now()}.mp4`;

      const filePath =
        path.join(CACHE_DIR, fileName);

      await fs.writeFile(filePath, buffer);

      console.log(
        `[TikTok] Saved: ${filePath}`
      );

      // =========================
      // Send video
      // =========================

      await api.sendMessage(
        {
          body:
            `🎬 | 𝗧𝗶𝗸𝗧𝗼𝗸 𝗩𝗶𝗱𝗲𝗼\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `👤 Author: ${video.author}\n` +
            `👁️ Views: ${formatNumber(video.views)}\n` +
            `❤️ Likes: ${formatNumber(video.likes)}\n` +
            `💬 Comments: ${formatNumber(video.comments)}\n` +
            `🔁 Shares: ${formatNumber(video.shares)}\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `✅ Download Complete`,
          attachment: fs.createReadStream(filePath)
        },
        threadID
      );

      // =========================
      // Delete cache
      // =========================

      setTimeout(async () => {
        try {
          if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);

            console.log(
              `[TikTok] Cache deleted: ${filePath}`
            );
          }
        } catch (err) {
          console.error(
            "[TikTok] Cache delete error:",
            err.message
          );
        }
      }, 120000);
    } catch (error) {
      console.error(
        "[TikTok] Download Error:",
        error?.response?.data || error
      );

      return api.sendMessage(
        `❌ | TikTok download failed.\n\n${getErrorMessage(
          error
        )}`,
        threadID,
        messageID
      );
    }
  }
};

// ==========================================================
// HELPERS
// ==========================================================

function formatNumber(value) {
  const num = Number(value);

  if (!Number.isFinite(num)) {
    return String(value || 0);
  }

  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }

  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }

  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }

  return String(num);
}

function getErrorMessage(error) {
  try {
    if (!error) {
      return "Unknown error";
    }

    if (typeof error === "string") {
      return error;
    }

    if (error.message) {
      return error.message;
    }

    if (error.response?.data) {
      const data = error.response.data;

      if (Buffer.isBuffer(data)) {
        const text = data.toString("utf8");

        try {
          return JSON.stringify(
            JSON.parse(text),
            null,
            2
          );
        } catch {
          return text.slice(0, 1500);
        }
      }

      if (typeof data === "object") {
        return (
          data.detail ||
          data.message ||
          data.error ||
          JSON.stringify(data, null, 2)
        );
      }

      return String(data);
    }

    return JSON.stringify(error, null, 2);
  } catch {
    return "Unknown error occurred.";
  }
}