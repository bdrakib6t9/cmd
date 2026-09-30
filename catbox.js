const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../../data");
const STORE_FILE = path.join(DATA_DIR, "catbox.json");


// ─────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(
      STORE_FILE,
      JSON.stringify([], null, 2)
    );
  }
}

function loadStore() {
  ensureStore();

  try {
    const data = JSON.parse(
      fs.readFileSync(STORE_FILE, "utf8")
    );

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("[CATBOX STORE READ ERROR]", error);

    return [];
  }
}

function saveStore(data) {
  ensureStore();

  fs.writeFileSync(
    STORE_FILE,
    JSON.stringify(data, null, 2)
  );
}


// ─────────────────────────────────────────────
// FILE SIZE
// ─────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes) return "0 B";

  const units = [
    "B",
    "KB",
    "MB",
    "GB"
  ];

  const index = Math.floor(
    Math.log(bytes) / Math.log(1024)
  );

  return (
    (bytes / Math.pow(1024, index)).toFixed(2) +
    " " +
    units[index]
  );
}


// ─────────────────────────────────────────────
// GET EXTENSION
// ─────────────────────────────────────────────

function getExtension(contentType, mediaType) {
  const extensionMap = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",

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

  if (extensionMap[contentType]) {
    return extensionMap[contentType];
  }

  if (mediaType.includes("photo") ||
      mediaType.includes("image")) {
    return "jpg";
  }

  if (mediaType.includes("gif")) {
    return "gif";
  }

  if (mediaType.includes("video")) {
    return "mp4";
  }

  if (mediaType.includes("audio") ||
      mediaType.includes("music")) {
    return "mp3";
  }

  return "bin";
}


// ─────────────────────────────────────────────
// MEDIA EMOJI
// ─────────────────────────────────────────────

function getEmoji(mediaType) {
  mediaType = String(mediaType || "").toLowerCase();

  if (
    mediaType.includes("photo") ||
    mediaType.includes("image")
  ) {
    return "🖼️";
  }

  if (mediaType.includes("gif")) {
    return "🎞️";
  }

  if (mediaType.includes("video") ||
      mediaType.includes("animated")) {
    return "🎬";
  }

  if (mediaType.includes("audio") ||
      mediaType.includes("music")) {
    return "🎵";
  }

  return "📁";
}


// ─────────────────────────────────────────────
// DOWNLOAD SAVED CATBOX FILE
// ─────────────────────────────────────────────

async function downloadSavedFile(api, event, item) {
  const send = (msg) =>
    api.sendMessage(
      msg,
      event.threadID,
      event.messageID
    );

  let tempFile = null;

  try {
    await send(
      `⏳ Downloading #${item.id}...\n\n🔗 ${item.url}`
    );

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

    const buffer = Buffer.from(response.data);

    if (!buffer.length) {
      throw new Error(
        "Downloaded file is empty"
      );
    }

    let contentType =
      response.headers["content-type"] ||
      "application/octet-stream";

    if (contentType.includes("text/html")) {
      contentType = "application/octet-stream";
    }

    let extension =
      getExtension(
        contentType,
        item.type || ""
      );

    // Stored extension থাকলে সেটাই আগে
    if (item.extension) {
      extension = item.extension;
    }

    let filename =
      item.filename ||
      `catbox_${item.id}.${extension}`;

    // Invalid filename characters remove
    filename = filename.replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      "_"
    );

    tempFile = path.join(
      DATA_DIR,
      `tmp_${Date.now()}_${filename}`
    );

    fs.writeFileSync(
      tempFile,
      buffer
    );

    await api.sendMessage(
      {
        body:
          `🐱 CATBOX #${item.id}\n\n` +
          `${getEmoji(item.type)} ${item.type || "file"}\n` +
          `📦 ${formatBytes(buffer.length)}\n` +
          `🔗 ${item.url}`,
        attachment: fs.createReadStream(tempFile)
      },
      event.threadID,
      event.messageID
    );

    // Temporary file delete
    try {
      fs.unlinkSync(tempFile);
    } catch {}

  } catch (error) {
    console.error(
      "[CATBOX DOWNLOAD ERROR]",
      error.response?.data ||
      error.message ||
      error
    );

    if (tempFile) {
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }

    let reason =
      error.response?.data ||
      error.message ||
      "Unknown error";

    if (typeof reason !== "string") {
      reason = JSON.stringify(reason);
    }

    return send(
      `❌ CATBOX DOWNLOAD FAILED\n\n` +
      `📛 Error:\n${reason}`
    );
  }
}


// ─────────────────────────────────────────────
// SHOW LIST
// ─────────────────────────────────────────────

async function showList(api, event) {
  const send = (msg) =>
    api.sendMessage(
      msg,
      event.threadID,
      event.messageID
    );

  const store = loadStore();

  if (!store.length) {
    return send(
      `🐱 CATBOX STORE\n\n` +
      `📭 কোনো link store করা নেই!\n\n` +
      `📌 কোনো media-তে reply দিয়ে:\n` +
      `catbox`
    );
  }

  let text =
    `╭───────────────╮\n` +
    `   🐱 CATBOX LIST\n` +
    `╰───────────────╯\n\n`;

  store.forEach((item, index) => {
    text +=
      `${index + 1}. ${getEmoji(item.type)} ` +
      `${item.type || "file"}\n` +
      `   🔗 ${item.url}\n` +
      `   📦 ${item.size || "Unknown"}\n\n`;
  });

  text +=
    `━━━━━━━━━━━━━━━━━━\n` +
    `📌 কোনো number reply করো\n` +
    `যেমন: 1 / 2 / 3\n\n` +
    `অথবা:\n` +
    `catbox 1`;

  return send(text);
}


// ─────────────────────────────────────────────
// GET NUMBER FROM COMMAND / REPLY
// ─────────────────────────────────────────────

function getRequestedNumber(event, args) {

  // catbox 3
  if (args && args.length) {
    const number = parseInt(args[0]);

    if (!isNaN(number)) {
      return number;
    }
  }

  // list message reply করে শুধু "3"
  if (event.messageReply) {
    const body =
      String(
        event.messageReply.body || ""
      ).trim();

    if (/^\d+$/.test(body)) {
      return parseInt(body);
    }
  }

  return null;
}


// ─────────────────────────────────────────────
// MAIN MODULE
// ─────────────────────────────────────────────

module.exports = {
  config: {
    name: "catbox",
    version: "3.0.0",
    author: "Rakib",
    countDown: 5,
    role: 0,
    shortDescription:
      "Upload media to Catbox and store links",
    longDescription:
      "Upload replied media to Catbox, save links and download them by serial number.",
    category: "utility",
    guide:
      "Reply media: {pn}catbox\n" +
      "List: {pn}catbox list\n" +
      "Download: reply number to list message\n" +
      "Or: {pn}catbox <number>\n" +
      "Clear: {pn}catbox clear"
  },

  onStart: async function ({
    api,
    event,
    args
  }) {

    const send = (msg) =>
      api.sendMessage(
        msg,
        event.threadID,
        event.messageID
      );

    try {

      // ─────────────────────────────────────────
      // COMMAND
      // ─────────────────────────────────────────

      const command =
        String(args?.[0] || "")
          .toLowerCase();

      // ─────────────────────────────────────────
      // CATBOX LIST
      // ─────────────────────────────────────────

      if (command === "list") {
        return showList(api, event);
      }


      // ─────────────────────────────────────────
      // CATBOX CLEAR
      // ─────────────────────────────────────────

      if (command === "clear") {

        const store = loadStore();

        if (!store.length) {
          return send(
            "📭 Catbox store already empty!"
          );
        }

        saveStore([]);

        return send(
          `✅ CATBOX STORE CLEARED!\n\n` +
          `🗑️ Deleted: ${store.length} links`
        );
      }


      // ─────────────────────────────────────────
      // DOWNLOAD BY NUMBER
      // ─────────────────────────────────────────

      const requestedNumber =
        getRequestedNumber(
          event,
          args
        );

      if (requestedNumber !== null) {

        const store = loadStore();

        if (!store.length) {
          return send(
            "📭 Catbox store empty!"
          );
        }

        if (
          requestedNumber < 1 ||
          requestedNumber > store.length
        ) {
          return send(
            `❌ Invalid number!\n\n` +
            `📌 Available: 1 - ${store.length}`
          );
        }

        const item =
          store[requestedNumber - 1];

        // ID নতুন করে ensure
        item.id = requestedNumber;

        return downloadSavedFile(
          api,
          event,
          item
        );
      }


      // ─────────────────────────────────────────
      // CHECK REPLY MEDIA
      // ─────────────────────────────────────────

      if (!event.messageReply) {

        return send(
          `🐱 CATBOX\n\n` +
          `📌 Usage:\n\n` +

          `1️⃣ Upload:\n` +
          `কোনো Photo / GIF / Video / Audio-তে reply দিয়ে:\n` +
          `catbox\n\n` +

          `2️⃣ List:\n` +
          `catbox list\n\n` +

          `3️⃣ Download:\n` +
          `catbox 1\n` +
          `অথবা list message-এ reply করে:\n` +
          `1\n\n` +

          `4️⃣ Clear:\n` +
          `catbox clear`
        );
      }


      // ─────────────────────────────────────────
      // GET ATTACHMENTS
      // ─────────────────────────────────────────

      const attachments =
        event.messageReply.attachments || [];

      if (!attachments.length) {
        return send(
          "❌ Reply করা message-এ কোনো attachment নেই!"
        );
      }


      // First valid attachment
      const attachment =
        attachments.find(
          item => item && item.url
        );

      if (!attachment) {
        return send(
          "❌ Attachment-এর download URL পাওয়া যায়নি!"
        );
      }


      const mediaType =
        String(
          attachment.type || "file"
        ).toLowerCase();

      const emoji =
        getEmoji(mediaType);


      // ─────────────────────────────────────────
      // UPLOAD START
      // ─────────────────────────────────────────

      await send(
        `${emoji} Media detected!\n` +
        `⏳ Catbox-এ upload করছি...`
      );


      // ─────────────────────────────────────────
      // DOWNLOAD FROM FACEBOOK
      // ─────────────────────────────────────────

      const response =
        await axios.get(
          attachment.url,
          {
            responseType: "arraybuffer",
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
              "User-Agent":
                "Mozilla/5.0"
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


      // ─────────────────────────────────────────
      // CONTENT TYPE
      // ─────────────────────────────────────────

      let contentType =
        response.headers["content-type"] ||
        "application/octet-stream";


      // Facebook মাঝে মাঝে HTML content-type দেয়
      if (
        contentType.includes("text/html")
      ) {
        contentType =
          "application/octet-stream";
      }


      // ─────────────────────────────────────────
      // EXTENSION
      // ─────────────────────────────────────────

      const extension =
        getExtension(
          contentType,
          mediaType
        );


      const filename =
        `facebook_${Date.now()}.${extension}`;


      // ─────────────────────────────────────────
      // CATBOX FORM
      // ─────────────────────────────────────────

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


      // ─────────────────────────────────────────
      // UPLOAD
      // ─────────────────────────────────────────

      const upload =
        await axios.post(
          "https://catbox.moe/user/api.php",
          form,
          {
            headers: {
              ...form.getHeaders(),
              "User-Agent":
                "Mozilla/5.0"
            },
            timeout: 180000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          }
        );


      const result =
        String(
          upload.data || ""
        ).trim();


      if (
        !result ||
        !result.startsWith("https://")
      ) {
        throw new Error(
          result ||
          "Catbox returned an invalid response"
        );
      }


      // ─────────────────────────────────────────
      // SAVE TO STORE
      // ─────────────────────────────────────────

      const store =
        loadStore();


      // Duplicate check
      const duplicate =
        store.find(
          item => item.url === result
        );


      if (duplicate) {

        return send(
          `╭───────────────╮\n` +
          `   🐱 CATBOX\n` +
          `╰───────────────╯\n\n` +

          `${emoji} Type: ${mediaType}\n` +
          `📦 Size: ${formatBytes(buffer.length)}\n\n` +

          `🔗 ${result}\n\n` +

          `♻️ এই link আগে থেকেই store করা আছে!\n` +
          `🔢 Serial: #${duplicate.id}`
        );
      }


      const newItem = {
        id: store.length + 1,
        url: result,
        type: mediaType,
        size: formatBytes(buffer.length),
        bytes: buffer.length,
        filename,
        extension,
        contentType,
        uploadedAt:
          new Date().toISOString()
      };


      store.push(newItem);

      saveStore(store);


      // ─────────────────────────────────────────
      // SUCCESS
      // ─────────────────────────────────────────

      return send(
        `╭───────────────╮\n` +
        `   🐱 CATBOX UPLOAD\n` +
        `╰───────────────╯\n\n` +

        `${emoji} Type: ${mediaType}\n` +
        `📦 Size: ${formatBytes(buffer.length)}\n` +
        `🔢 Serial: #${newItem.id}\n\n` +

        `🔗 ${result}\n\n` +

        `💾 Store-এ save হয়েছে!\n` +
        `✅ Upload Successful!`
      );

    } catch (error) {

      console.error(
        "[CATBOX ERROR]",
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


      return send(
        `❌ CATBOX UPLOAD FAILED\n\n` +
        `📛 Error:\n${reason}\n\n` +
        `🔄 আবার চেষ্টা করো।`
      );
    }
  }
};