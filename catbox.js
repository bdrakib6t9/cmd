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

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, "[]", "utf8");
  }
}

function loadStore() {
  ensureStore();

  try {
    const data = JSON.parse(
      fs.readFileSync(STORE_FILE, "utf8")
    );

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveStore(data) {
  ensureStore();

  fs.writeFileSync(
    STORE_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return (
    (bytes / Math.pow(1024, index)).toFixed(2) +
    " " +
    units[index]
  );
}

function getEmoji(type) {
  type = String(type || "").toLowerCase();

  if (
    type.includes("photo") ||
    type.includes("image")
  ) return "🖼️";

  if (type.includes("gif")) return "🎞️";

  if (
    type.includes("video") ||
    type.includes("animated")
  ) return "🎬";

  if (
    type.includes("audio") ||
    type.includes("music")
  ) return "🎵";

  return "📁";
}

function getExtension(contentType, mediaType) {
  contentType = String(contentType || "")
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

  mediaType = String(mediaType || "").toLowerCase();

  if (
    mediaType.includes("photo") ||
    mediaType.includes("image")
  ) return "jpg";

  if (mediaType.includes("gif")) return "gif";
  if (mediaType.includes("video")) return "mp4";

  if (
    mediaType.includes("audio") ||
    mediaType.includes("music")
  ) return "mp3";

  return "bin";
}


// ═══════════════════════════════════════════════
// MESSAGE EDIT
// ═══════════════════════════════════════════════

async function editMessage(api, text, messageID) {
  try {
    if (
      messageID &&
      typeof api.editMessage === "function"
    ) {
      await api.editMessage(
        text,
        messageID
      );

      return true;
    }
  } catch (error) {
    console.error(
      "[CATBOX EDIT ERROR]",
      error.message
    );
  }

  return false;
}


// ═══════════════════════════════════════════════
// DELETE MESSAGE
// ═══════════════════════════════════════════════

async function deleteMessage(api, messageID) {
  if (!messageID) return;

  try {
    if (
      typeof api.unsendMessage === "function"
    ) {
      await api.unsendMessage(messageID);
    }
  } catch (error) {
    console.error(
      "[CATBOX DELETE ERROR]",
      error.message
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
  const form = new FormData();

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

  const response = await axios.post(
    CATBOX_API,
    form,
    {
      headers: {
        ...form.getHeaders(),
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/plain,*/*"
      },

      timeout: 180000,

      maxContentLength: Infinity,
      maxBodyLength: Infinity,

      validateStatus: () => true
    }
  );

  const result =
    String(response.data || "").trim();

  console.log(
    "[CATBOX RESPONSE]",
    response.status,
    result
  );

  if (
    response.status < 200 ||
    response.status >= 300
  ) {
    throw new Error(
      `HTTP ${response.status}: ${result}`
    );
  }

  if (
    !/^https?:\/\/.+/i.test(result)
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
  const form = new FormData();

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

  const response = await axios.post(
    LITTERBOX_API,
    form,
    {
      headers: {
        ...form.getHeaders(),
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/plain,*/*"
      },

      timeout: 180000,

      maxContentLength: Infinity,
      maxBodyLength: Infinity,

      validateStatus: () => true
    }
  );

  const result =
    String(response.data || "").trim();

  console.log(
    "[LITTERBOX RESPONSE]",
    response.status,
    result
  );

  if (
    response.status < 200 ||
    response.status >= 300
  ) {
    throw new Error(
      `HTTP ${response.status}: ${result}`
    );
  }

  if (
    !/^https?:\/\/.+/i.test(result)
  ) {
    throw new Error(
      result ||
      "Invalid Litterbox response"
    );
  }

  return result;
}


// ═══════════════════════════════════════════════
// DOWNLOAD SAVED FILE
// ═══════════════════════════════════════════════

async function downloadSavedFile(
  api,
  event,
  item
) {
  let tempFile = null;

  try {
    const statusMessage =
      await api.sendMessage(
        `⏳ #${item.id} download করছি...`,
        event.threadID
      );

    try {
      if (
        statusMessage &&
        statusMessage.messageID
      ) {
        await editMessage(
          api,
          `⏳ #${item.id}\n\n` +
          `📥 File download হচ্ছে...`,
          statusMessage.messageID
        );
      }
    } catch {}

    const response = await axios.get(
      item.url,
      {
        responseType: "arraybuffer",
        timeout: 180000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,

        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    const buffer =
      Buffer.from(response.data);

    if (!buffer.length) {
      throw new Error(
        "Downloaded file is empty"
      );
    }

    let filename =
      item.filename ||
      `catbox_${item.id}.${item.extension || "bin"}`;

    filename = filename.replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      "_"
    );

    tempFile = path.join(
      DATA_DIR,
      `catbox_tmp_${Date.now()}_${filename}`
    );

    fs.writeFileSync(
      tempFile,
      buffer
    );

    await api.sendMessage(
      {
        body:
          `🐱 ${item.host || "Catbox"} #${item.id}\n\n` +
          `${getEmoji(item.type)} Type: ${item.type || "file"}\n` +
          `📦 Size: ${formatBytes(buffer.length)}\n` +
          `🌐 Host: ${item.host || "Catbox"}\n\n` +
          `🔗 ${item.url}`,

        attachment:
          fs.createReadStream(tempFile)
      },

      event.threadID
    );

    if (
      statusMessage &&
      statusMessage.messageID
    ) {
      await deleteMessage(
        api,
        statusMessage.messageID
      );
    }

  } catch (error) {
    console.error(
      "[CATBOX DOWNLOAD ERROR]",
      error.response?.data ||
      error.message ||
      error
    );

    let reason =
      error.response?.data ||
      error.message ||
      "Unknown error";

    if (
      typeof reason !== "string"
    ) {
      reason =
        JSON.stringify(reason);
    }

    return api.sendMessage(
      `❌ DOWNLOAD FAILED\n\n` +
      `📛 ${reason}\n\n` +
      `💡 Litterbox link হলে 72h expiry শেষ হয়ে যেতে পারে।`,
      event.threadID
    );

  } finally {
    if (tempFile) {
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }
  }
}


// ═══════════════════════════════════════════════
// SHOW LIST
// ═══════════════════════════════════════════════

async function showList(api, event) {
  const store = loadStore();

  if (!store.length) {
    return api.sendMessage(
      `🐱 CATBOX LIST\n\n` +
      `📭 Store-এ কোনো file নেই।`,
      event.threadID,
      event.messageID
    );
  }

  let text =
    `╭────────────────╮\n` +
    `     🐱 CATBOX LIST\n` +
    `╰────────────────╯\n\n`;

  store.forEach((item, index) => {
    text +=
      `${index + 1}. ` +
      `${getEmoji(item.type)} ` +
      `${item.type || "file"}\n` +

      `   🌐 ${item.host || "Catbox"}\n` +

      `   📦 ${item.size || "Unknown"}\n` +

      `   🔗 ${item.url}\n`;

    if (
      item.host === "Litterbox"
    ) {
      text +=
        `   ⏳ Expiry: 72 hours\n`;
    }

    text += "\n";
  });

  text +=
    `━━━━━━━━━━━━━━━━━━\n` +
    `📌 এই message-এ reply করে number পাঠাও।\n` +
    `Example: 1`;

  return api.sendMessage(
    text,
    event.threadID,
    event.messageID
  );
}


// ═══════════════════════════════════════════════
// GET NUMBER
// ═══════════════════════════════════════════════

function getNumber(event, args) {
  if (
    args &&
    args.length
  ) {
    const n =
      parseInt(args[0]);

    if (!isNaN(n)) {
      return n;
    }
  }

  if (
    event.messageReply
  ) {
    const body =
      String(
        event.messageReply.body || ""
      ).trim();

    if (
      /^\d+$/.test(body)
    ) {
      return parseInt(body);
    }
  }

  return null;
}


// ═══════════════════════════════════════════════
// MODULE
// ═══════════════════════════════════════════════

module.exports = {

  config: {
    name: "catbox",
    version: "6.0.0",
    author: "Rakib",
    countDown: 5,
    role: 0,

    shortDescription:
      "Catbox upload and file store",

    longDescription:
      "Upload media to Catbox with Litterbox fallback, store links and download by serial.",

    category: "utility",

    guide:
      "{pn}catbox\n" +
      "{pn}catbox list\n" +
      "{pn}catbox <number>\n" +
      "{pn}catbox clear"
  },


  onStart: async function ({
    api,
    event,
    args
  }) {

    const command =
      String(
        args?.[0] || ""
      ).toLowerCase();


    // ═══════════════════════════════════════════
    // LIST
    // ═══════════════════════════════════════════

    if (
      command === "list"
    ) {
      return showList(
        api,
        event
      );
    }


    // ═══════════════════════════════════════════
    // CLEAR
    // ═══════════════════════════════════════════

    if (
      command === "clear"
    ) {
      const store =
        loadStore();

      saveStore([]);

      return api.sendMessage(
        `✅ CATBOX STORE CLEARED\n\n` +
        `🗑️ Deleted: ${store.length} files`,
        event.threadID,
        event.messageID
      );
    }


    // ═══════════════════════════════════════════
    // DOWNLOAD NUMBER
    // ═══════════════════════════════════════════

    const number =
      getNumber(
        event,
        args
      );

    if (
      number !== null
    ) {
      const store =
        loadStore();

      if (!store.length) {
        return api.sendMessage(
          "📭 Catbox store empty!",
          event.threadID,
          event.messageID
        );
      }

      if (
        number < 1 ||
        number > store.length
      ) {
        return api.sendMessage(
          `❌ Invalid number!\n\n` +
          `📌 Available: 1 - ${store.length}`,
          event.threadID,
          event.messageID
        );
      }

      /*
       * যদি list message-এ reply করে number দেওয়া হয়,
       * তাহলে list message delete করে দিচ্ছি।
       */
      if (
        event.messageReply &&
        event.messageReply.messageID
      ) {
        await deleteMessage(
          api,
          event.messageReply.messageID
        );
      }

      const item =
        store[number - 1];

      return downloadSavedFile(
        api,
        event,
        item
      );
    }


    // ═══════════════════════════════════════════
    // UPLOAD
    // ═══════════════════════════════════════════

    if (
      !event.messageReply
    ) {
      return api.sendMessage(
        `🐱 CATBOX\n\n` +
        `📤 Upload:\n` +
        `Media-তে reply করে catbox\n\n` +

        `📋 List:\n` +
        `catbox list\n\n` +

        `📥 Download:\n` +
        `catbox 1\n` +
        `অথবা list message-এ reply করে 1\n\n` +

        `🗑️ Clear:\n` +
        `catbox clear`,
        event.threadID,
        event.messageID
      );
    }


    const attachments =
      event.messageReply.attachments || [];

    if (
      !attachments.length
    ) {
      return api.sendMessage(
        "❌ Reply করা message-এ attachment নেই!",
        event.threadID,
        event.messageID
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
      return api.sendMessage(
        "❌ Attachment URL পাওয়া যায়নি!",
        event.threadID,
        event.messageID
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


    // ═══════════════════════════════════════════
    // ONE STATUS MESSAGE
    // ═══════════════════════════════════════════

    const status =
      await api.sendMessage(
        `${emoji} Media detected!\n` +
        `⏳ Download হচ্ছে...`,
        event.threadID
      );

    const statusID =
      status?.messageID;


    try {

      // ─────────────────────────────────────────
      // DOWNLOAD FACEBOOK MEDIA
      // ─────────────────────────────────────────

      const response =
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
          response.data
        );

      if (
        !buffer.length
      ) {
        throw new Error(
          "Downloaded file is empty"
        );
      }


      let contentType =
        response.headers[
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


      await editMessage(
        api,

        `${emoji} Media detected!\n` +
        `📦 Size: ${formatBytes(buffer.length)}\n` +
        `⏳ Catbox-এ upload হচ্ছে...`,

        statusID
      );


      // ═══════════════════════════════════════
      // CATBOX → LITTERBOX
      // ═══════════════════════════════════════

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

          `⚠️ Catbox upload failed!\n\n` +
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


      // ═══════════════════════════════════════
      // STORE
      // ═══════════════════════════════════════

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

        await editMessage(
          api,

          `♻️ Already stored!\n\n` +
          `🌐 ${host}\n` +
          `🔢 Serial: #${duplicate.id}\n\n` +
          `🔗 ${url}`,

          statusID
        );

        return;
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


      // ═══════════════════════════════════════
      // SUCCESS → EDIT SAME MESSAGE
      // ═══════════════════════════════════════

      let expiry = "";

      if (
        host ===
        "Litterbox"
      ) {
        expiry =
          `\n⏳ Expiry: 72 hours`;
      }

      await editMessage(
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
        "[CATBOX FINAL ERROR]",
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

      await editMessage(
        api,

        `❌ UPLOAD FAILED\n\n` +
        `📛 Error:\n${reason}\n\n` +
        `🔄 আবার চেষ্টা করো।`,

        statusID
      );
    }
  }
};