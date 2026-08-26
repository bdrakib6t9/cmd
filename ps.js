const { getStreamFromURL } = global.utils;
const Jimp = require("jimp");
const { Readable } = require("stream");
const fs = require("fs");
const axios = require("axios");
const { getAvatarUrl } = require("../../rakib/customApi/getAvatarUrl");

module.exports = {
  config: {
    name: "ps",
    version: "1.4",
    author: "Rakib + hoon",
    category: "love",
    guide: "{prefix}ps [@mention/reply]"
  },

  onStart: async function ({
    event,
    threadsData,
    message,
    usersData
  }) {
    try {
      /* =====================================================
       * BASIC HELPERS
       * ===================================================== */

      const getMemberUID = member => {
        if (!member) return null;

        const id =
          member.userID ??
          member.userId ??
          member.id ??
          null;

        if (
          id === null ||
          id === undefined ||
          String(id).trim() === ""
        ) {
          return null;
        }

        return String(id);
      };

      const uidI = String(event.senderID);

      /* =====================================================
       * THREAD DATA
       * ===================================================== */

      const threadData =
        await threadsData.get(event.threadID);

      if (!threadData) {
        return message.reply(
          "❌ Thread data not available."
        );
      }

      const members =
        Array.isArray(threadData.members)
          ? threadData.members
          : [];

      if (!members.length) {
        return message.reply(
          "❌ No group members found."
        );
      }

      /* =====================================================
       * FIND MEMBER
       * ===================================================== */

      const findMember = id => {
        const wantedID = String(id || "");

        if (!wantedID) {
          return null;
        }

        return members.find(member => {
          const memberID =
            getMemberUID(member);

          return (
            memberID &&
            memberID === wantedID
          );
        });
      };

      /* =====================================================
       * SENDER
       * ===================================================== */

      const senderInfo =
        findMember(uidI);

      if (!senderInfo) {
        return message.reply(
          "❌ Could not find your info in this group."
        );
      }

      let name1 =
        await usersData
          .getName(uidI)
          .catch(() => null);

      if (!name1) {
        name1 =
          senderInfo?.name ||
          senderInfo?.fullName ||
          "Unknown User";
      }

      const gender1 =
        senderInfo?.gender;

      console.log(
        `[PS] SENDER UID: ${uidI}`
      );

      console.log(
        `[PS] SENDER NAME: ${name1}`
      );

      /* =====================================================
       * TARGET ID
       * ===================================================== */

      let targetId = null;

      /* ---------- REPLY ---------- */

      if (
        event.type === "message_reply" &&
        event.messageReply?.senderID
      ) {
        targetId =
          String(
            event.messageReply.senderID
          );

        console.log(
          `[PS] TARGET SOURCE: REPLY`
        );

        console.log(
          `[PS] REPLY UID: ${targetId}`
        );
      }

      /* ---------- MENTION ---------- */

      if (
        !targetId &&
        event.mentions &&
        typeof event.mentions === "object"
      ) {
        const mentionIDs =
          Object.keys(event.mentions);

        if (mentionIDs.length > 0) {
          targetId =
            String(
              mentionIDs[0]
            );

          console.log(
            `[PS] TARGET SOURCE: MENTION`
          );

          console.log(
            `[PS] MENTION UID: ${targetId}`
          );
        }
      }

      /* =====================================================
       * RANDOM TARGET
       * ===================================================== */

      const pickRandomRoyal = () => {
        const senderGender =
          String(
            gender1 || ""
          ).toUpperCase();

        let targetGender = null;

        if (senderGender === "MALE") {
          targetGender = "FEMALE";
        } else if (
          senderGender === "FEMALE"
        ) {
          targetGender = "MALE";
        }

        /* ---------- ALL VALID MEMBERS ---------- */

        let available =
          members.filter(member => {
            const memberID =
              getMemberUID(member);

            return (
              memberID &&
              memberID !== uidI &&
              member.inGroup !== false
            );
          });

        /* ---------- OPPOSITE GENDER ---------- */

        if (targetGender) {
          const genderList =
            available.filter(member =>
              String(
                member.gender || ""
              ).toUpperCase() ===
              targetGender
            );

          if (genderList.length > 0) {
            available = genderList;
          }
        }

        if (!available.length) {
          return null;
        }

        const randomMember =
          available[
            Math.floor(
              Math.random() *
              available.length
            )
          ];

        console.log(
          `[PS] RANDOM MEMBER RAW:`,
          JSON.stringify(
            randomMember,
            null,
            2
          )
        );

        console.log(
          `[PS] RANDOM MEMBER UID:`,
          getMemberUID(
            randomMember
          )
        );

        return randomMember;
      };

      /* =====================================================
       * RESOLVE TARGET MEMBER
       * ===================================================== */

      let matchedInfo = null;

      /* ---------- REQUESTED TARGET ---------- */

      if (
        targetId &&
        targetId !== uidI
      ) {
        matchedInfo =
          findMember(targetId);

        if (matchedInfo) {
          console.log(
            `[PS] TARGET FOUND IN MEMBERS`
          );

          console.log(
            `[PS] TARGET MEMBER:`,
            JSON.stringify(
              matchedInfo,
              null,
              2
            )
          );
        } else {
          console.log(
            `[PS] TARGET UID ${targetId} NOT FOUND IN THREAD MEMBERS`
          );
        }
      }

      /* ---------- RANDOM FALLBACK ---------- */

      if (!matchedInfo) {
        matchedInfo =
          pickRandomRoyal();

        if (matchedInfo) {
          targetId =
            getMemberUID(
              matchedInfo
            );
        }
      }

      if (!matchedInfo) {
        return message.reply(
          "❌ Could not find anyone to pair with you."
        );
      }

      /* =====================================================
       * FINAL TARGET UID
       * ===================================================== */

      const matchedId =
        getMemberUID(
          matchedInfo
        );

      console.log(
        "================================"
      );

      console.log(
        `[PS] FINAL TARGET UID: ${matchedId}`
      );

      console.log(
        `[PS] FINAL TARGET ID: ${targetId}`
      );

      console.log(
        `[PS] FINAL TARGET NAME: ${
          matchedInfo?.name ||
          matchedInfo?.fullName ||
          "Unknown"
        }`
      );

      console.log(
        "================================"
      );

      if (!matchedId) {
        return message.reply(
          "❌ Could not get target user ID."
        );
      }

      /* =====================================================
       * TARGET NAME
       * ===================================================== */

      let name2 =
        await usersData
          .getName(matchedId)
          .catch(() => null);

      if (!name2) {
        name2 =
          matchedInfo?.name ||
          matchedInfo?.fullName ||
          "Unknown User";
      }

      const gender2 =
        matchedInfo?.gender;

      console.log(
        `[PS] USER 1 => ${uidI} | ${name1}`
      );

      console.log(
        `[PS] USER 2 => ${matchedId} | ${name2}`
      );

      /* =====================================================
       * FANCY NAME
       * ===================================================== */

      function toFancyItalic(inputName) {
        const name =
          String(inputName || "");

        const map = {
          A: "𝑨",
          B: "𝑩",
          C: "𝑪",
          D: "𝑫",
          E: "𝑬",
          F: "𝑭",
          G: "𝑮",
          H: "𝑯",
          I: "𝑰",
          J: "𝑱",
          K: "𝑲",
          L: "𝑳",
          M: "𝑴",
          N: "𝑵",
          O: "𝑶",
          P: "𝑷",
          Q: "𝑸",
          R: "𝑹",
          S: "𝑺",
          T: "𝑻",
          U: "𝑼",
          V: "𝑽",
          W: "𝑾",
          X: "𝑿",
          Y: "𝒀",
          Z: "𝒁",

          a: "𝒂",
          b: "𝒃",
          c: "𝒄",
          d: "𝒅",
          e: "𝒆",
          f: "𝒇",
          g: "𝒈",
          h: "𝒉",
          i: "𝒊",
          j: "𝒋",
          k: "𝒌",
          l: "𝒍",
          m: "𝒎",
          n: "𝒏",
          o: "𝒐",
          p: "𝒑",
          q: "𝒒",
          r: "𝒓",
          s: "𝒔",
          t: "𝒕",
          u: "𝒖",
          v: "𝒗",
          w: "𝒘",
          x: "𝒙",
          y: "𝒚",
          z: "𝒛"
        };

        return name
          .split("")
          .map(
            ch => map[ch] || ch
          )
          .join("");
      }

      const fancyName1 =
        toFancyItalic(name1);

      const fancyName2 =
        toFancyItalic(name2);

      /* =====================================================
       * KING / QUEEN
       * ===================================================== */

      let titleLine1 = "";
      let titleLine2 = "";

      const g1 =
        String(
          gender1 || ""
        ).toUpperCase();

      const g2 =
        String(
          gender2 || ""
        ).toUpperCase();

      if (
        g1 === "MALE" &&
        g2 === "FEMALE"
      ) {
        titleLine1 =
          `🦁 𝐊𝐢𝐧𝐠: ${fancyName1}`;

        titleLine2 =
          `👑 𝐐𝐮𝐞𝐞𝐧: ${fancyName2}`;

      } else if (
        g1 === "FEMALE" &&
        g2 === "MALE"
      ) {
        titleLine1 =
          `👑 𝐐𝐮𝐞𝐞𝐧: ${fancyName1}`;

        titleLine2 =
          `🦁 𝐊𝐢𝐧𝐠: ${fancyName2}`;

      } else {
        titleLine1 =
          "👑 𝐑𝐨𝐲𝐚𝐥 𝐃𝐮𝐨:";

        titleLine2 =
          `💞 ${fancyName1}  &  ${fancyName2}`;
      }

      /* =====================================================
       * ROYAL %
       * ===================================================== */

      const lovePercent =
        Math.floor(
          Math.random() * 41
        ) + 60;

      const royalChemistry =
        Math.floor(
          Math.random() * 41
        ) + 60;

      /* =====================================================
       * MESSAGE
       * ===================================================== */

      const msg =
`👑✨ 𝐑𝐨𝐲𝐚𝐥 𝐏𝐚𝐢𝐫 𝐑𝐞𝐯𝐞𝐚𝐥 ✨👑

💫 Tonight, the throne shines a little brighter…
two souls have been crowned in this royal match.

${titleLine1}
${titleLine2}

❤️ 𝐑𝐨𝐲𝐚𝐥 𝐋𝐨𝐯𝐞 𝐑𝐚𝐭𝐢𝐧𝐠: ${lovePercent}%
🌟 𝐑𝐨𝐲𝐚𝐥 𝐂𝐡𝐞𝐦𝐢𝐬𝐭𝐫𝐲: ${royalChemistry}%

✨ May this King & Queen energy bring elegance, loyalty,
and a story worthy of a royal legend. ✨`;

      /* =====================================================
       * BACKGROUND
       * ===================================================== */

      const bgUrls = [
        "https://i.postimg.cc/qvymkXx4/pr.jpg",
        "https://raw.githubusercontent.com/bdrakib12/baby-goat-bot/main/scripts/cmds/cache/pr.png"
      ];

      async function streamToBuffer(stream) {
        return new Promise(
          (resolve, reject) => {
            const chunks = [];

            stream.on(
              "data",
              chunk => chunks.push(chunk)
            );

            stream.on(
              "end",
              () =>
                resolve(
                  Buffer.concat(chunks)
                )
            );

            stream.on(
              "error",
              reject
            );
          }
        );
      }

      let bgImage = null;

      for (const url of bgUrls) {
        try {
          console.log(
            `[PS] Loading background: ${url}`
          );

          const bgStream =
            await getStreamFromURL(url);

          const bgBuffer =
            await streamToBuffer(
              bgStream
            );

          bgImage =
            await Jimp.read(
              bgBuffer
            );

          console.log(
            "[PS] Background loaded."
          );

          break;

        } catch (error) {
          console.log(
            "[PS] Background failed:",
            error?.message ||
              error
          );
        }
      }

      if (!bgImage) {
        return message.reply(msg);
      }

      const bg = bgImage;

      /* =====================================================
       * PLACEHOLDER
       * ===================================================== */

      async function createPlaceholderAvatar(name) {
        const size = 210;

        const img =
          new Jimp(
            size,
            size,
            "#f0f0ff"
          );

        const initials =
          String(name || "U")
            .trim()
            .split(/\s+/)
            .map(
              word => word[0]
            )
            .filter(Boolean)
            .join("")
            .toUpperCase()
            .slice(0, 2);

        const font =
          await Jimp.loadFont(
            Jimp.FONT_SANS_32_BLACK
          );

        img.print(
          font,
          0,
          0,
          {
            text: initials,
            alignmentX:
              Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY:
              Jimp.VERTICAL_ALIGN_MIDDLE
          },
          size,
          size
        );

        return img;
      }

      /* =====================================================
       * DOWNLOAD AVATAR
       * ===================================================== */

      async function downloadAvatar(
        url,
        userID
      ) {
        if (
          typeof url !== "string" ||
          !/^https?:\/\//i.test(url)
        ) {
          console.log(
            `[PS] Invalid avatar URL for ${userID}`
          );

          return null;
        }

        try {
          console.log(
            `[PS] Downloading avatar for UID: ${userID}`
          );

          console.log(
            `[PS] URL: ${url}`
          );

          const response =
            await axios.get(
              url,
              {
                responseType:
                  "arraybuffer",

                timeout: 20000,

                maxRedirects: 10,

                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",

                  "Accept":
                    "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",

                  "Referer":
                    "https://www.facebook.com/"
                },

                validateStatus:
                  status =>
                    status >= 200 &&
                    status < 400
              }
            );

          if (!response.data) {
            throw new Error(
              "Empty response"
            );
          }

          const buffer =
            Buffer.from(
              response.data
            );

          if (!buffer.length) {
            throw new Error(
              "Empty image buffer"
            );
          }

          console.log(
            `[PS] Downloaded ${userID}: ${buffer.length} bytes`
          );

          const image =
            await Jimp.read(
              buffer
            );

          console.log(
            `[PS] Image decoded: ${userID}`
          );

          return image;

        } catch (error) {
          console.log(
            `[PS] Avatar download failed ${userID}:`,
            error?.response?.status ||
              error?.message ||
              error
          );

          return null;
        }
      }

      /* =====================================================
       * LOAD AVATAR
       * ===================================================== */

      async function loadAvatar(
        fallbackName,
        userID
      ) {
        const uid =
          String(userID || "");

        if (!uid) {
          console.log(
            "[PS] Avatar UID missing!"
          );

          return createPlaceholderAvatar(
            fallbackName
          );
        }

        console.log(
          "--------------------------------"
        );

        console.log(
          `[PS] FETCH AVATAR UID: ${uid}`
        );

        console.log(
          `[PS] FETCH AVATAR NAME: ${fallbackName}`
        );

        /* ---------- GET FRESH URL ---------- */

        let avatarURL = null;

        try {
          avatarURL =
            await getAvatarUrl(uid);

          console.log(
            `[PS] getAvatarUrl(${uid}) =>`,
            avatarURL || "NULL"
          );

        } catch (error) {
          console.log(
            `[PS] getAvatarUrl failed ${uid}:`,
            error?.message ||
              error
          );
        }

        /* ---------- BUFFER ---------- */

        if (
          Buffer.isBuffer(
            avatarURL
          )
        ) {
          try {
            const image =
              await Jimp.read(
                avatarURL
              );

            console.log(
              `[PS] Buffer avatar OK: ${uid}`
            );

            return image;

          } catch (error) {
            console.log(
              `[PS] Buffer decode failed ${uid}:`,
              error?.message
            );
          }
        }

        /* ---------- LOCAL FILE ---------- */

        if (
          typeof avatarURL ===
            "string" &&
          fs.existsSync(
            avatarURL
          )
        ) {
          try {
            const image =
              await Jimp.read(
                avatarURL
              );

            console.log(
              `[PS] Local avatar OK: ${uid}`
            );

            return image;

          } catch (error) {
            console.log(
              `[PS] Local avatar failed ${uid}:`,
              error?.message
            );
          }
        }

        /* ---------- URL ---------- */

        if (
          typeof avatarURL ===
            "string" &&
          /^https?:\/\//i.test(
            avatarURL
          )
        ) {
          const image =
            await downloadAvatar(
              avatarURL,
              uid
            );

          if (image) {
            return image;
          }
        }

        /* ---------- PLACEHOLDER ---------- */

        console.log(
          `[PS] PLACEHOLDER USED: ${uid}`
        );

        return createPlaceholderAvatar(
          fallbackName
        );
      }

      /* =====================================================
       * LOAD BOTH AVATARS
       * ===================================================== */

      console.log(
        "================================"
      );

      console.log(
        `[PS] AVATAR 1 UID: ${uidI}`
      );

      console.log(
        `[PS] AVATAR 2 UID: ${matchedId}`
      );

      console.log(
        "================================"
      );

      /*
       * IMPORTANT:
       * দুইটা completely independent call.
       */

      const img1 =
        await loadAvatar(
          name1,
          uidI
        );

      const img2 =
        await loadAvatar(
          name2,
          matchedId
        );

      /* =====================================================
       * RESIZE + CIRCLE
       * ===================================================== */

      const avatar1 =
        img1
          .resize(210, 210)
          .circle();

      const avatar2 =
        img2
          .resize(210, 210)
          .circle();

      /* =====================================================
       * POSITIONS
       * ===================================================== */

      const pos1 = {
        x: 65,
        y: 104
      };

      const pos2 = {
        x: 460,
        y: 104
      };

      /* =====================================================
       * COMPOSITE
       * ===================================================== */

      bg.composite(
        avatar1,
        pos1.x,
        pos1.y
      );

      bg.composite(
        avatar2,
        pos2.x,
        pos2.y
      );

      /* =====================================================
       * OUTPUT
       * ===================================================== */

      const finalBuffer =
        await bg.getBufferAsync(
          Jimp.MIME_PNG
        );

      const imgStream =
        Readable.from(
          finalBuffer
        );

      imgStream.path =
        "pr.png";

      /* =====================================================
       * SEND
       * ===================================================== */

      return message.reply({
        body: msg,
        attachment: imgStream
      });

    } catch (err) {
      console.error(
        "[PS] COMMAND ERROR:",
        err
      );

      return message.reply(
        "❌ An unexpected error occurred. Please try again later."
      );
    }
  }
};