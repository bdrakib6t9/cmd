const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "tiktok",
    aliases: ["tik"],
    version: "3.0",
    author: "Hoon",

    countDown: 5,
    role: 0,

    shortDescription: "TikTok Search",

    longDescription:
      "Search TikTok videos using Hoon TikTok API and download selected videos by reply.",

    category: "media",

    guide: "{pn} <query>"
  },

  /*
   * ============================================
   * ON START
   * ============================================
   */

  onStart: async function ({
    message,
    args,
    event,
    commandName
  }) {
    let wait;

    try {
      /*
       * ==========================================
       * QUERY
       * ==========================================
       */

      const query =
        args.join(" ").trim();

      if (!query) {
        return message.reply(
          "⚠️ | Please enter a TikTok search query."
        );
      }

      /*
       * ==========================================
       * GET API URL
       * ==========================================
       */

      const rawApi =
        "https://raw.githubusercontent.com/bdrakib6t9/HOON/main/apiUrl.json";

      const apiConfig =
        await axios.get(rawApi, {
          timeout: 30000
        });

      const baseUrl =
        String(
          apiConfig.data?.tik || ""
        )
          .trim()
          .replace(/\/+$/, "");

      if (!baseUrl) {
        return message.reply(
          "❌ | TikTok API URL not found in apiUrl.json."
        );
      }

      /*
       * ==========================================
       * SEARCH MESSAGE
       * ==========================================
       */

      wait = await message.reply(
`🔍 Searching TikTok...

📝 Query: ${query}
⏳ Please wait...`
      );

      /*
       * ==========================================
       * SEARCH API
       * POST /search
       * ==========================================
       */

      const searchResponse =
        await axios.post(
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
              "Content-Type":
                "application/json"
            }
          }
        );

      const data =
        searchResponse.data;

      /*
       * ==========================================
       * CHECK RESULTS
       * ==========================================
       */

      if (
        !data ||
        !Array.isArray(
          data.results
        ) ||
        data.results.length === 0
      ) {
        try {
          await message.unsend(
            wait.messageID,
            event.threadID
          );
        } catch {}

        return message.reply(
          "❌ | No TikTok results found."
        );
      }

      /*
       * ==========================================
       * NORMALIZE RESULTS
       * ==========================================
       */

      const results =
        data.results
          .filter(
            item =>
              item &&
              item.id
          )
          .slice(0, 10)
          .map(item => ({
            id: String(
              item.id
            ),

            title:
              item.description ||
              item.desc ||
              "TikTok Video",

            author:
              item.author_username ||
              item.author_unique_id ||
              item.author ||
              "Unknown",

            authorName:
              item.author_username ||
              item.author_unique_id ||
              item.author ||
              "Unknown",

            thumbnail:
              item.cover ||
              item.cover_url ||
              item.thumbnail ||
              null,

            region:
              item.region_code ||
              "Unknown",

            views:
              Number(
                item.view_count ||
                item.play_count ||
                item.stats?.playCount ||
                0
              ),

            likes:
              Number(
                item.like_count ||
                item.digg_count ||
                item.stats?.diggCount ||
                0
              ),

            comments:
              Number(
                item.comment_count ||
                item.stats?.commentCount ||
                0
              ),

            shares:
              Number(
                item.share_count ||
                item.stats?.shareCount ||
                0
              )
          }));

      if (!results.length) {
        try {
          await message.unsend(
            wait.messageID,
            event.threadID
          );
        } catch {}

        return message.reply(
          "❌ | No usable TikTok results found."
        );
      }

      /*
       * ==========================================
       * CACHE
       * ==========================================
       */

      const cacheFolder =
        path.join(
          __dirname,
          "cache"
        );

      await fs.ensureDir(
        cacheFolder
      );

      /*
       * ==========================================
       * RESULT MESSAGE
       * ==========================================
       */

      let msg =
        `╭──『 TIKTOK SEARCH 』──╮\n`;

      msg +=
        `🔎 Query: ${query}\n`;

      msg +=
        `📦 Results: ${results.length}\n`;

      msg +=
        `⚡ API: Hoon TikTok API\n`;

      msg +=
        `╰────────────────────╯\n\n`;

      const attachments = [];
      const thumbnailPaths = [];

      /*
       * ==========================================
       * DOWNLOAD THUMBNAILS
       * ==========================================
       */

      for (
        let i = 0;
        i < results.length;
        i++
      ) {
        const item =
          results[i];

        const title =
          String(
            item.title ||
            "TikTok Video"
          );

        msg +=
          `〔 ${i + 1} 〕 ${item.author}\n`;

        msg +=
          `🎬 ${title.slice(0, 80)}${
            title.length > 80
              ? "..."
              : ""
          }\n`;

        msg +=
          `👁 ${formatNumber(
            item.views
          )}  ❤️ ${formatNumber(
            item.likes
          )}\n\n`;

        /*
         * Thumbnail
         */

        if (item.thumbnail) {
          try {
            const thumbPath =
              path.join(
                cacheFolder,
                `thumb_${Date.now()}_${i}.jpg`
              );

            const thumbResponse =
              await axios.get(
                item.thumbnail,
                {
                  responseType:
                    "arraybuffer",

                  headers: {
                    "User-Agent":
                      "Mozilla/5.0"
                  },

                  timeout: 30000
                }
              );

            await fs.writeFile(
              thumbPath,
              Buffer.from(
                thumbResponse.data
              )
            );

            attachments.push(
              fs.createReadStream(
                thumbPath
              )
            );

            thumbnailPaths.push(
              thumbPath
            );

          } catch (error) {
            console.log(
              `Thumbnail ${
                i + 1
              } failed:`,
              error.message
            );
          }
        }
      }

      /*
       * ==========================================
       * REPLY INSTRUCTION
       * ==========================================
       */

      msg +=
        `💬 Reply with a number (1-${results.length}) to download.`;

      /*
       * ==========================================
       * REMOVE SEARCHING MESSAGE
       * ==========================================
       */

      try {
        await message.unsend(
          wait.messageID,
          event.threadID
        );
      } catch {}

      /*
       * ==========================================
       * SEND RESULTS
       * ==========================================
       */

      const sent =
        await message.reply({
          body: msg,

          attachment:
            attachments.length
              ? attachments
              : undefined
        });

      /*
       * ==========================================
       * DELETE THUMBNAILS
       * ==========================================
       */

      setTimeout(
        async () => {
          for (
            const file
            of thumbnailPaths
          ) {
            try {
              if (
                await fs.pathExists(
                  file
                )
              ) {
                await fs.remove(
                  file
                );
              }
            } catch {}
          }
        },
        30000
      );

      /*
       * ==========================================
       * SAVE REPLY DATA
       * ==========================================
       */

      global.GoatBot.onReply.set(
        sent.messageID,
        {
          commandName,

          author:
            event.senderID,

          results,

          messageID:
            sent.messageID,

          threadID:
            event.threadID,

          baseUrl
        }
      );

    } catch (error) {
      console.error(
        "TikTok Search Error:",
        error
      );

      /*
       * Remove waiting message
       */

      if (wait) {
        try {
          await message.unsend(
            wait.messageID,
            event.threadID
          );
        } catch {}
      }

      return message.reply(
`❌ | TikTok search failed.

${getErrorMessage(error)}`
      );
    }
  },

  /*
   * ============================================
   * ON REPLY
   * ============================================
   */

  onReply: async function ({
    message,
    Reply,
    event
  }) {
    let downloading = null;
    let filePath = null;

    try {
      /*
       * ==========================================
       * ONLY ORIGINAL USER
       * ==========================================
       */

      if (
        String(
          event.senderID
        ) !==
        String(
          Reply.author
        )
      ) {
        return;
      }

      /*
       * ==========================================
       * PARSE NUMBER
       * ==========================================
       */

      const num =
        parseInt(
          String(
            event.body
          ).trim(),
          10
        );

      if (
        Number.isNaN(num) ||
        num < 1 ||
        num >
          Reply.results.length
      ) {
        return message.reply(
          `⚠️ | Invalid number.\n\nPlease reply with 1-${Reply.results.length}.`
        );
      }

      /*
       * ==========================================
       * SELECT VIDEO
       * ==========================================
       */

      const video =
        Reply.results[
          num - 1
        ];

      if (
        !video ||
        !video.id
      ) {
        return message.reply(
          "❌ | TikTok video ID not found."
        );
      }

      /*
       * ==========================================
       * REMOVE SEARCH RESULT
       * ==========================================
       */

      try {
        await message.unsend(
          Reply.messageID,
          event.threadID
        );
      } catch {}

      /*
       * ==========================================
       * DOWNLOAD MESSAGE
       * ==========================================
       */

      downloading =
        await message.reply(
`⏳ Downloading video ${num}...

👤 ${
  video.author ||
  "Unknown"
}

📥 Please wait...`
        );

      /*
       * ==========================================
       * CACHE FOLDER
       * ==========================================
       */

      const cacheFolder =
        path.join(
          __dirname,
          "cache"
        );

      await fs.ensureDir(
        cacheFolder
      );

      /*
       * ==========================================
       * FILE PATH
       * ==========================================
       */

      filePath =
        path.join(
          cacheFolder,
          `tik_${Date.now()}_${event.senderID}.mp4`
        );

      /*
       * ==========================================
       * BUILD TIKTOK URL
       * ==========================================
       */

      const tiktokUrl =
        `https://www.tiktok.com/@${encodeURIComponent(
          video.author
        )}/video/${video.id}`;

      console.log(
        "TikTok URL:",
        tiktokUrl
      );

      /*
       * ==========================================
       * GET VIDEO INFO
       * GET /video
       * ==========================================
       */

      const videoResponse =
        await axios.get(
          `${Reply.baseUrl}/video`,
          {
            params: {
              url: tiktokUrl
            },

            timeout: 120000
          }
        );

      const videoData =
        videoResponse.data;

      console.log(
        "TikTok video API response received."
      );

      /*
       * ==========================================
       * FIND VIDEO URL
       * ==========================================
       *
       * API currently returns:
       *
       * data.play_url
       *
       * and:
       *
       * data.download_url = null
       *
       */

      const downloadUrl =
        videoData?.data?.download_url ||
        videoData?.data?.play_url ||
        videoData?.download_url ||
        videoData?.play_url ||
        videoData?.result?.download_url ||
        videoData?.result?.play_url ||
        null;

      if (!downloadUrl) {
        console.log(
          "TikTok API response:",
          JSON.stringify(
            videoData,
            null,
            2
          )
        );

        throw new Error(
          "TikTok API did not return a video URL."
        );
      }

      console.log(
        "TikTok play URL found."
      );

      /*
       * ==========================================
       * DOWNLOAD DIRECTLY
       * ==========================================
       *
       * IMPORTANT:
       *
       * We DO NOT call:
       *
       * /download
       *
       * anymore.
       *
       * We directly download the
       * play_url returned by /video.
       */

      const response =
        await axios.get(
          downloadUrl,
          {
            responseType:
              "arraybuffer",

            timeout: 300000,

            maxContentLength:
              Infinity,

            maxBodyLength:
              Infinity,

            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

              "Referer":
                "https://www.tiktok.com/",

              "Accept":
                "video/mp4,video/*,*/*"
            }
          }
        );

      /*
       * ==========================================
       * VALIDATE RESPONSE
       * ==========================================
       */

      if (
        !response.data ||
        !response.data.length
      ) {
        throw new Error(
          "TikTok video response is empty."
        );
      }

      /*
       * ==========================================
       * SAVE MP4
       * ==========================================
       */

      await fs.writeFile(
        filePath,
        Buffer.from(
          response.data
        )
      );

      /*
       * ==========================================
       * CHECK FILE
       * ==========================================
       */

      const stat =
        await fs.stat(
          filePath
        );

      if (
        !stat.size
      ) {
        throw new Error(
          "Downloaded video file is empty."
        );
      }

      console.log(
        `TikTok downloaded successfully: ${(
          stat.size /
          1024 /
          1024
        ).toFixed(2)} MB`
      );

      /*
       * ==========================================
       * REMOVE DOWNLOAD MESSAGE
       * ==========================================
       */

      try {
        await message.unsend(
          downloading.messageID,
          event.threadID
        );
      } catch {}

      /*
       * ==========================================
       * SEND VIDEO
       * ==========================================
       */

      const sentVideo =
        await message.reply({
          body:
`🚀 𝗧𝗘𝗦𝗦𝗔 𝗕𝗢𝗧 🤖
🎬 𝗧𝗶𝗸𝗧𝗼𝗸 𝗩𝗶𝗱𝗲𝗼 𝗗𝗲𝗹𝗶𝘃𝗲𝗿𝗲𝗱
💎 𝗤𝘂𝗮𝗹𝗶𝘁𝘆 𝗖𝗼𝗻𝘁𝗲𝗻𝘁
━━━━━━━━━━━━━━
👤 Author: ${
  video.author ||
  "Unknown"
}
📝 ${
  video.title ||
  "TikTok Video"
}
👁 Views: ${
  formatNumber(
    video.views
  )
}
❤️ Likes: ${
  formatNumber(
    video.likes
  )
}
━━━━━━━━━━━━━━
modified:hoon`,

          attachment:
            fs.createReadStream(
              filePath
            )
        });

      /*
       * ==========================================
       * DELETE VIDEO LATER
       * ==========================================
       */

      setTimeout(
        async () => {
          try {
            if (
              await fs.pathExists(
                filePath
              )
            ) {
              await fs.remove(
                filePath
              );
            }
          } catch (
            error
          ) {
            console.log(
              "Failed to delete TikTok file:",
              error.message
            );
          }
        },
        15000
      );

      return sentVideo;

    } catch (error) {
      /*
       * ==========================================
       * ERROR LOG
       * ==========================================
       */

      console.error(
        "TikTok Download Error:",
        error
      );

      /*
       * ==========================================
       * REMOVE DOWNLOAD MESSAGE
       * ==========================================
       */

      if (downloading) {
        try {
          await message.unsend(
            downloading.messageID,
            event.threadID
          );
        } catch {}
      }

      /*
       * ==========================================
       * REMOVE BROKEN FILE
       * ==========================================
       */

      if (filePath) {
        try {
          if (
            await fs.pathExists(
              filePath
            )
          ) {
            await fs.remove(
              filePath
            );
          }
        } catch {}
      }

      /*
       * ==========================================
       * SEND CLEAN ERROR
       * ==========================================
       */

      return message.reply(
`❌ | TikTok download failed.

${getErrorMessage(error)}`
      );
    }
  }
};


/*
 * ============================================
 * ERROR HELPER
 * ============================================
 */

function getErrorMessage(error) {
  if (!error) {
    return "Unknown error.";
  }

  /*
   * Axios response
   */

  const data =
    error?.response?.data;

  if (
    typeof data ===
    "string"
  ) {
    return data;
  }

  if (
    data &&
    typeof data ===
      "object"
  ) {
    if (
      typeof data.detail ===
      "string"
    ) {
      return data.detail;
    }

    if (
      typeof data.message ===
      "string"
    ) {
      return data.message;
    }

    if (
      data.detail &&
      typeof data.detail ===
        "object"
    ) {
      return JSON.stringify(
        data.detail,
        null,
        2
      );
    }

    try {
      return JSON.stringify(
        data,
        null,
        2
      );
    } catch {}
  }

  /*
   * Normal Error
   */

  if (
    error.message
  ) {
    return error.message;
  }

  return String(error);
}


/*
 * ============================================
 * NUMBER FORMAT
 * ============================================
 */

function formatNumber(number) {
  number =
    Number(number || 0);

  if (
    number >= 1000000000
  ) {
    return (
      (
        number /
        1000000000
      )
        .toFixed(1)
        .replace(
          ".0",
          ""
        ) +
      "B"
    );
  }

  if (
    number >= 1000000
  ) {
    return (
      (
        number /
        1000000
      )
        .toFixed(1)
        .replace(
          ".0",
          ""
        ) +
      "M"
    );
  }

  if (
    number >= 1000
  ) {
    return (
      (
        number /
        1000
      )
        .toFixed(1)
        .replace(
          ".0",
          ""
        ) +
      "K"
    );
  }

  return String(
    number
  );
}