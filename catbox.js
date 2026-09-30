const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../../data");
const STORE_FILE = path.join(DATA_DIR, "catbox.json");

const CATBOX_API =
  "https://catbox.moe/user/api.php";

const LITTERBOX_API =
  "https://litterbox.catbox.moe/resources/internals/api.php";


// ═══════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
      recursive: true
    });
  }

  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(
      STORE_FILE,
      "[]",
      "utf8"
    );
  }
}

function loadStore() {
  ensureStore();

  try {
    const data = JSON.parse(
      fs.readFileSync(
        STORE_FILE,
        "utf8"
      )
    );

    return Array.isArray(data)
      ? data
      : [];
  } catch (e) {
    console.error(
      "[CATBOX STORE]",
      e
    );

    return [];
  }
}

function saveStore(data) {
  ensureStore();

  fs.writeFileSync(
    STORE_FILE,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf8"
  );
}


// ═══════════════════════════════════════════════
// SIZE
// ═══════════════════════════════════════════════

function formatBytes(bytes) {
  if (!bytes) return "0 B";

  const units = [
    "B",
    "KB",
    "MB",
    "GB"
  ];

  const index = Math.min(
    Math.floor(
      Math.log(bytes) /
      Math.log(1024)
    ),
    units.length - 1
  );

  return (
    (
      bytes /
      Math.pow(1024, index)
    ).toFixed(2) +
    " " +
    units[index]
  );
}


// ═══════════════════════════════════════════════
// EMOJI
// ═══════════════════════════════════════════════

function getEmoji(type) {
  type = String(
    type || ""
  ).toLowerCase();

  if (
    type.includes("photo") ||
    type.includes("image")
  ) {
    return "🖼️";
  }

  if (type.includes("gif")) {
    return "🎞️";
  }

  if (
    type.includes("video") ||
    type.includes("animated")
  ) {
    return "🎬";
  }

  if (
    type.includes("audio") ||
    type.includes("music")
  ) {
    return "🎵";
  }

  return "📁";
}


// ═══════════════════════════════════════════════
// EXTENSION
// ═══════════════════════════════════════════════

function getExtension(
  contentType,
  mediaType
) {
  contentType = String(
    contentType || ""
  )
    .split(";")[0]
    .trim()
    .toLowerCase();

  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",

    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-matroska": "mkv",

    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/flac": "flac",

    "application/pdf": "pdf",
    "application/zip": "zip",
    "application/json": "json",
    "text/plain": "txt"
  };

  if (map[contentType]) {
    return map[contentType];
  }

  mediaType = String(
    mediaType || ""
  ).toLowerCase();

  if (
    mediaType.includes("photo") ||
    mediaType.includes("image")
  ) {
    return "jpg";
  }

  if (mediaType.includes("gif")) {
    return "gif";
  }

  if (mediaType.includes("video")) {
    return "mp4";
  }

  if (
    mediaType.includes("audio") ||
    mediaType.includes("music")
  ) {
    return "mp3";
  }

  return "bin";
}


// ═══════════════════════════════════════════════
// EDIT MESSAGE
// ═══════════════════════════════════════════════

async function editMessage(
  api,
  text,
  messageID
) {
  try {
    if (
      messageID &&
      typeof api.editMessage ===
        "function"
    ) {
      await api.editMessage(
        text,
        messageID
      );

      return true;
    }
  } catch (e) {
    console.error(
      "[CATBOX EDIT]",
      e.message
    );
  }

  return false;
}


// ═══════════════════════════════════════════════
// DELETE MESSAGE
// ═══════════════════════════════════════════════

async function deleteMessage(
  api,
  messageID
) {
  if (!messageID) return;

  try {
    if (
      typeof api.unsendMessage ===
      "function"
    ) {
      await api.unsendMessage(
        messageID
      );
    }
  } catch (e) {
    console.error(
      "[CATBOX DELETE]",
      e.message
    );
  }
}


// ═══════════════════════════════════════════════
// CATBOX UPLOAD
// ═══════════════════════════════════════════════

async function uploadCatbox(
  buffer,
  filename,
  contentType
) {
  const form =
    new FormData();

  form.append(
    "reqtype",
    "fileupload"
  );

  form.append(
    "fileToUpload",
    buffer,
    {
      filename,
      contentType
    }
  );

  const res =
    await axios.post(
      CATBOX_API,
      form,
      {
        headers: {
          ...form.getHeaders(),

          "User-Agent":
            "Mozilla/5.0",

          "Accept":
            "text/plain,*/*"
        },

        timeout: 180000,

        maxContentLength:
          Infinity,

        maxBodyLength:
          Infinity,

        validateStatus:
          () => true
      }
    );

  const result =
    String(
      res.data || ""
    ).trim();

  console.log(
    "[CATBOX]",
    res.status,
    result
  );

  if (
    res.status < 200 ||
    res.status >= 300
  ) {
    throw new Error(
      `HTTP ${res.status}: ${result}`
    );
  }

  if (
    !/^https?:\/\/.+/i.test(
      result
    )
  ) {
    throw new Error(
      result ||
      "Invalid Catbox response"
    );
  }

  return result;
}


// ═══════════════════════════════════════════════
// LITTERBOX FALLBACK
// ═══════════════════════════════════════════════

async function uploadLitterbox(
  buffer,
  filename,
  contentType
) {
  const form =
    new FormData();

  form.append(
    "reqtype",
    "fileupload"
  );

  form.append(
    "time",
    "72h"
  );

  form.append(
    "fileToUpload",
    buffer,
    {
      filename,
      contentType
    }
  );

  const res =
    await axios.post(
      LITTERBOX_API,
      form,
      {
        headers: {
          ...form.getHeaders(),

          "User-Agent":
            "Mozilla/5.0",

          "Accept":
            "text/plain,*/*"
        },

        timeout: 180000,

        maxContentLength:
          Infinity,

        maxBodyLength:
          Infinity,

        validateStatus:
          () => true
      }
    );

  const result =
    String(
      res.data || ""
    ).trim();

  console.log(
    "[LITTERBOX]",
    res.status,
    result
  );

  if (
    res.status < 200 ||
    res.status >= 300
  ) {
    throw new Error(
      `HTTP ${res.status}: ${result}`
    );
  }

  if (
    !/^https?:\/\/.+/i.test(
      result
    )
  ) {
    throw new Error(
      result ||
      "Invalid Litterbox response"
    );
  }

  return result;
}


// ═══════════════════════════════════════════════
// DOWNLOAD
// ═══════════════════════════════════════════════

async function downloadFile({
  api,
  event,
  item,
  message
}) {
  let tempFile = null;

  try {

    // ─────────────────────────────────────────
    // STATUS
    // ─────────────────────────────────────────

    const loading =
      await message.reply(
        `⏳ Downloading #${item.id}...`
      );

    try {
      await editMessage(
        api,

        `⏳ #${item.id}\n\n` +
        `📥 File download হচ্ছে...`,

        loading?.messageID
      );
    } catch {}


    // ─────────────────────────────────────────
    // DOWNLOAD
    // ─────────────────────────────────────────

    const res =
      await axios.get(
        item.url,
        {
          responseType:
            "arraybuffer",

          timeout:
            180000,

          maxContentLength:
            Infinity,

          maxBodyLength:
            Infinity,

          headers: {
            "User-Agent":
              "Mozilla/5.0"
          }
        }
      );

    const buffer =
      Buffer.from(
        res.data
      );

    if (!buffer.length) {
      throw new Error(
        "Downloaded file is empty"
      );
    }


    // ─────────────────────────────────────────
    // FILE NAME
    // ─────────────────────────────────────────

    let filename =
      item.filename ||
      `catbox_${item.id}.${item.extension || "bin"}`;

    filename =
      filename.replace(
        /[<>:"/\\|?*\x00-\x1F]/g,
        "_"
      );


    tempFile =
      path.join(
        DATA_DIR,
        `catbox_${Date.now()}_${filename}`
      );


    fs.writeFileSync(
      tempFile,
      buffer
    );


    // ─────────────────────────────────────────
    // DELETE OLD LOADING
    // ─────────────────────────────────────────

    if (
      loading?.messageID
    ) {
      try {
        await message.unsend(
          loading.messageID,
          event.threadID
        );
      } catch {}
    }


    // ─────────────────────────────────────────
    // SEND FILE
    // ─────────────────────────────────────────

    return message.reply({
      body:
        `🐱 ${item.host || "Catbox"} #${item.id}\n\n` +
        `${getEmoji(item.type)} ${item.type || "file"}\n` +
        `📦 ${formatBytes(buffer.length)}\n\n` +
        `🔗 ${item.url}`,

      attachment:
        fs.createReadStream(
          tempFile
        )
    });

  } catch (e) {

    console.error(
      "[CATBOX DOWNLOAD]",
      e.response?.data ||
      e.message ||
      e
    );

    return message.reply(
      `❌ Download failed.\n\n` +
      `📛 ${e.message}`
    );

  } finally {

    // File stream open হওয়ার জন্য
    // একটু delay দিয়ে temp file remove
    if (tempFile) {
      setTimeout(() => {
        try {
          fs.unlinkSync(
            tempFile
          );
        } catch {}
      }, 10000);
    }
  }
}


// ═══════════════════════════════════════════════
// SHOW LIST
// ═══════════════════════════════════════════════

async function showList({
  api,
  event,
  message
}) {
  const store =
    loadStore();

  if (!store.length) {
    return message.reply(
      `🐱 CATBOX LIST\n\n` +
      `📭 Store-এ কোনো file নেই।`
    );
  }

  let body =
    `╭────────────────╮\n` +
    `     🐱 CATBOX LIST\n` +
    `╰────────────────╯\n\n`;

  store.forEach(
    (item, index) => {

      body +=
        `${index + 1}. ` +
        `${getEmoji(item.type)} ` +
        `${item.type || "file"}\n` +

        `   🌐 ${item.host || "Catbox"}\n` +

        `   📦 ${item.size || "Unknown"}\n` +

        `   🔗 ${item.url}\n`;

      if (
        item.host ===
        "Litterbox"
      ) {
        body +=
          `   ⏳ Expiry: 72h\n`;
      }

      body += "\n";
    }
  );

  body +=
    `━━━━━━━━━━━━━━━━━━\n` +
    `↩️ Reply with a number to download.\n` +
    `Example: 1`;


  const sent =
    await message.reply({
      body
    });


  // ═══════════════════════════════════════════
  // VERY IMPORTANT
  // Same system as your video command
  // ═══════════════════════════════════════════

  global.GoatBot.onReply.set(
    sent.messageID,
    {
      commandName:
        this.config.name,

      author:
        event.senderID,

      results:
        store
    }
  );

  return sent;
}


// ═══════════════════════════════════════════════
// MODULE
// ═══════════════════════════════════════════════

module.exports = {

  config: {
    name: "catbox",
    version: "7.0.0",
    author: "Rakib",
    countDown: 5,
    role: 0,

    shortDescription:
      "Catbox upload and store",

    longDescription:
      "Upload media to Catbox with Litterbox fallback and download stored files by reply.",

    category:
      "utility",

    guide:
      "{pn}catbox\n" +
      "{pn}catbox list\n" +
      "{pn}catbox <number>\n" +
      "{pn}catbox clear"
  },


  // ═══════════════════════════════════════════
  // ON START
  // ═══════════════════════════════════════════

  onStart: async function ({
    api,
    event,
    args,
    message
  }) {

    try {

      const command =
        String(
          args?.[0] || ""
        ).toLowerCase();


      // ─────────────────────────────────────────
      // LIST
      // ─────────────────────────────────────────

      if (
        command === "list"
      ) {
        return showList.call(
          this,
          {
            api,
            event,
            message
          }
        );
      }


      // ─────────────────────────────────────────
      // CLEAR
      // ─────────────────────────────────────────

      if (
        command === "clear"
      ) {

        const store =
          loadStore();

        saveStore([]);

        return message.reply(
          `✅ CATBOX STORE CLEARED\n\n` +
          `🗑️ Deleted: ${store.length} files`
        );
      }


      // ─────────────────────────────────────────
      // DIRECT NUMBER
      // catbox 1
      // ─────────────────────────────────────────

      if (
        args?.[0] &&
        /^\d+$/.test(
          String(args[0])
        )
      ) {

        const number =
          parseInt(
            args[0]
          );

        const store =
          loadStore();

        if (
          number < 1 ||
          number > store.length
        ) {
          return message.reply(
            `❌ Invalid number!\n\n` +
            `📌 Available: 1 - ${store.length}`
          );
        }

        return downloadFile({
          api,
          event,
          item:
            store[number - 1],
          message
        });
      }


      // ─────────────────────────────────────────
      // REPLY CHECK
      // ─────────────────────────────────────────

      if (
        !event.messageReply
      ) {
        return message.reply(
          `🐱 CATBOX\n\n` +

          `📤 Upload:\n` +
          `কোনো media-তে reply করে catbox\n\n` +

          `📋 List:\n` +
          `catbox list\n\n` +

          `📥 Download:\n` +
          `catbox 1\n` +
          `অথবা list-এ reply করে number\n\n` +

          `🗑️ Clear:\n` +
          `catbox clear`
        );
      }


      const attachments =
        event.messageReply.attachments ||
        [];


      if (
        !attachments.length
      ) {
        return message.reply(
          "❌ Reply করা message-এ attachment নেই!"
        );
      }


      const attachment =
        attachments.find(
          item =>
            item &&
            item.url
        );


      if (
        !attachment
      ) {
        return message.reply(
          "❌ Attachment URL পাওয়া যায়নি!"
        );
      }


      const mediaType =
        String(
          attachment.type ||
          "file"
        ).toLowerCase();

      const emoji =
        getEmoji(
          mediaType
        );


      // ═══════════════════════════════════════
      // ONE MESSAGE
      // ═══════════════════════════════════════

      const status =
        await message.reply(
          `${emoji} Media detected!\n` +
          `⏳ Download হচ্ছে...`
        );


      const statusID =
        status?.messageID;


      try {

        // ─────────────────────────────────────
        // DOWNLOAD FACEBOOK MEDIA
        // ─────────────────────────────────────

        const res =
          await axios.get(
            attachment.url,
            {
              responseType:
                "arraybuffer",

              timeout:
                120000,

              maxContentLength:
                Infinity,

              maxBodyLength:
                Infinity,

              headers: {
                "User-Agent":
                  "Mozilla/5.0"
              }
            }
          );


        const buffer =
          Buffer.from(
            res.data
          );


        if (
          !buffer.length
        ) {
          throw new Error(
            "Downloaded file is empty"
          );
        }


        let contentType =
          res.headers[
            "content-type"
          ] ||
          "application/octet-stream";


        contentType =
          String(
            contentType
          )
            .split(";")[0]
            .trim()
            .toLowerCase();


        if (
          contentType ===
          "text/html"
        ) {
          contentType =
            "application/octet-stream";
        }


        const extension =
          getExtension(
            contentType,
            mediaType
          );


        const filename =
          `facebook_${Date.now()}.${extension}`;


        // ─────────────────────────────────────
        // EDIT STATUS
        // ─────────────────────────────────────

        await editMessage(
          api,

          `${emoji} Media detected!\n` +
          `📦 Size: ${formatBytes(buffer.length)}\n` +
          `⏳ Catbox-এ upload হচ্ছে...`,

          statusID
        );


        // ═════════════════════════════════════
        // CATBOX → LITTERBOX
        // ═════════════════════════════════════

        let url;
        let host;


        try {

          url =
            await uploadCatbox(
              buffer,
              filename,
              contentType
            );

          host =
            "Catbox";

        } catch (catboxError) {

          console.error(
            "[CATBOX FAILED]",
            catboxError.message
          );


          await editMessage(
            api,

            `⚠️ Catbox failed!\n\n` +
            `📛 ${catboxError.message}\n\n` +
            `🔄 Litterbox fallback...`,

            statusID
          );


          url =
            await uploadLitterbox(
              buffer,
              filename,
              contentType
            );

          host =
            "Litterbox";
        }


        // ─────────────────────────────────────
        // STORE
        // ─────────────────────────────────────

        const store =
          loadStore();


        const duplicate =
          store.find(
            item =>
              item.url === url
          );


        if (
          duplicate
        ) {

          return editMessage(
            api,

            `♻️ Already stored!\n\n` +
            `🌐 ${host}\n` +
            `🔢 Serial: #${duplicate.id}\n\n` +
            `🔗 ${url}`,

            statusID
          );
        }


        const item = {

          id:
            store.length + 1,

          url,

          host,

          type:
            mediaType,

          size:
            formatBytes(
              buffer.length
            ),

          bytes:
            buffer.length,

          filename,

          extension,

          contentType,

          uploadedAt:
            new Date().toISOString()
        };


        store.push(
          item
        );

        saveStore(
          store
        );


        // ─────────────────────────────────────
        // SUCCESS
        // ─────────────────────────────────────

        let expiry =
          "";

        if (
          host ===
          "Litterbox"
        ) {
          expiry =
            `\n⏳ Expiry: 72h`;
        }


        return editMessage(
          api,

          `╭────────────────╮\n` +
          `     🐱 ${host.toUpperCase()}\n` +
          `╰────────────────╯\n\n` +

          `${emoji} Type: ${mediaType}\n` +
          `📦 Size: ${formatBytes(buffer.length)}\n` +
          `🔢 Serial: #${item.id}\n` +
          `🌐 Host: ${host}` +
          expiry +
          `\n\n` +

          `🔗 ${url}\n\n` +

          `💾 Store-এ save হয়েছে!\n` +
          `✅ Upload Successful!`,

          statusID
        );

      } catch (error) {

        console.error(
          "[CATBOX UPLOAD ERROR]",
          error.response?.data ||
          error.message ||
          error
        );


        let reason =
          error.response?.data ||
          error.message ||
          "Unknown error";


        if (
          typeof reason !==
          "string"
        ) {
          reason =
            JSON.stringify(
              reason
            );
        }


        return editMessage(
          api,

          `❌ UPLOAD FAILED\n\n` +
          `📛 Error:\n${reason}\n\n` +
          `🔄 আবার চেষ্টা করো।`,

          statusID
        );
      }

    } catch (e) {

      console.error(
        "[CATBOX COMMAND]",
        e
      );

      return message.reply(
        `❌ Error:\n${e.message}`
      );
    }
  },


  // ═══════════════════════════════════════════
  // ON REPLY
  // ═══════════════════════════════════════════

  onReply: async function ({
    api,
    event,
    Reply,
    message
  }) {

    try {

      // ─────────────────────────────────────────
      // ONLY ORIGINAL USER
      // ─────────────────────────────────────────

      if (
        event.senderID !==
        Reply.author
      ) {
        return;
      }


      // ─────────────────────────────────────────
      // NUMBER
      // ─────────────────────────────────────────

      const num =
        parseInt(
          String(
            event.body || ""
          ).trim()
        );


      if (
        isNaN(num)
      ) {
        return message.reply(
          "⚠️ | শুধু number দাও।\n\nExample: 1"
        );
      }


      const results =
        Reply.results || [];


      if (
        num < 1 ||
        num > results.length
      ) {
        return message.reply(
          `⚠️ | 1-${results.length} এর মধ্যে number দাও।`
        );
      }


      const item =
        results[num - 1];


      if (
        !item
      ) {
        return message.reply(
          "❌ | Invalid selection."
        );
      }


      // ═══════════════════════════════════════
      // DELETE LIST MESSAGE
      // ═══════════════════════════════════════

      try {

        /*
         * event.messageReply.messageID
         * = যে CATBOX LIST message-এ reply করা হয়েছে
         */

        await message.unsend(
          event.messageReply.messageID,
          event.threadID
        );

      } catch (e) {
        console.error(
          "[CATBOX LIST DELETE]",
          e.message
        );
      }


      // ═══════════════════════════════════════
      // DOWNLOAD
      // ═══════════════════════════════════════

      return downloadFile({
        api,
        event,
        item,
        message
      });

    } catch (e) {

      console.error(
        "[CATBOX ONREPLY]",
        e
      );

      return message.reply(
        `❌ Download failed.\n\n` +
        `${e.message}`
      );
    }
  }
};