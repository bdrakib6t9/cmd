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
  } catch (error) {
    console.error(
      "[CATBOX STORE READ]",
      error
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
  if (!bytes) {
    return "0 B";
  }

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

  if (
    type.includes("gif")
  ) {
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

  if (
    mediaType.includes("gif")
  ) {
    return "gif";
  }

  if (
    mediaType.includes("video")
  ) {
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
// UPLOAD → CATBOX
// ═══════════════════════════════════════════════

async function uploadToCatbox(
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

  const response =
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
      response.data || ""
    ).trim();

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
// UPLOAD → LITTERBOX FALLBACK
// ═══════════════════════════════════════════════

async function uploadToLitterbox(
  buffer,
  filename,
  contentType
) {
  const form = new FormData();

  form.append(
    "reqtype",
    "fileupload"
  );

  /*
   * Litterbox temporary storage.
   *
   * Allowed:
   * 1h
   * 12h
   * 24h
   * 72h
   */
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

  const response =
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
      response.data || ""
    ).trim();

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
// DOWNLOAD SAVED FILE
// ═══════════════════════════════════════════════

async function downloadSavedFile(
  api,
  event,
  item
) {
  const send = msg =>
    api.sendMessage(
      msg,
      event.threadID,
      event.messageID
    );

  let tempFile = null;

  try {

    await send(
      `⏳ #${item.id} download করছি...`
    );

    const response =
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
        response.data
      );

    if (!buffer.length) {
      throw new Error(
        "Downloaded file is empty"
      );
    }

    let filename =
      item.filename ||
      `catbox_${item.id}.${item.extension || "bin"}`;

    filename =
      filename.replace(
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
          `🐱 ${item.host || "CATBOX"} #${item.id}\n\n` +
          `${getEmoji(item.type)} Type: ${item.type || "file"}\n` +
          `📦 Size: ${formatBytes(buffer.length)}\n` +
          `🌐 Host: ${item.host || "Catbox"}\n\n` +
          `🔗 ${item.url}`,

        attachment:
          fs.createReadStream(
            tempFile
          )
      },

      event.threadID,
      event.messageID
    );

  } catch (error) {

    console.error(
      "[CATBOX DOWNLOAD]",
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
        JSON.stringify(
          reason
        );
    }

    return send(
      `❌ DOWNLOAD FAILED\n\n` +
      `📛 ${reason}\n\n` +
      `💡 যদি এটি Litterbox link হয়,\n` +
      `file-এর 72h expiry শেষ হয়ে যেতে পারে।`
    );

  } finally {

    if (tempFile) {
      try {
        fs.unlinkSync(
          tempFile
        );
      } catch {}
    }
  }
}


// ═══════════════════════════════════════════════
// LIST
// ═══════════════════════════════════════════════

function showList(
  api,
  event
) {
  const send = msg =>
    api.sendMessage(
      msg,
      event.threadID,
      event.messageID
    );

  const store =
    loadStore();

  if (!store.length) {
    return send(
      `🐱 CATBOX LIST\n\n` +
      `📭 Store-এ কোনো file নেই।`
    );
  }

  let text =
    `╭────────────────╮\n` +
    `     🐱 CATBOX LIST\n` +
    `╰────────────────╯\n\n`;

  store.forEach(
    (item, index) => {

      text +=
        `${index + 1}. ` +
        `${getEmoji(item.type)} ` +
        `${item.type || "file"}\n` +

        `   🌐 ${item.host || "Catbox"}\n` +

        `   🔗 ${item.url}\n` +

        `   📦 ${item.size || "Unknown"}\n`;

      if (
        item.host ===
        "Litterbox"
      ) {
        text +=
          `   ⏳ Expires: 72h\n`;
      }

      text += "\n";
    }
  );

  text +=
    `━━━━━━━━━━━━━━━━━━\n` +
    `📌 এই message-এ reply করে শুধু number পাঠাও।\n` +
    `Example: 2\n\n` +
    `অথবা:\n` +
    `catbox 2`;

  return send(
    text
  );
}


// ═══════════════════════════════════════════════
// NUMBER
// ═══════════════════════════════════════════════

function getNumber(
  event,
  args
) {

  // catbox 3
  if (
    args &&
    args.length
  ) {
    const n =
      parseInt(
        args[0]
      );

    if (
      !isNaN(n)
    ) {
      return n;
    }
  }

  // list message reply করে 3
  if (
    event.messageReply
  ) {

    const body =
      String(
        event.messageReply.body ||
        ""
      ).trim();

    if (
      /^\d+$/.test(
        body
      )
    ) {
      return parseInt(
        body
      );
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

    version: "5.0.0",

    author: "Rakib",

    countDown: 5,

    role: 0,

    shortDescription:
      "Catbox uploader + store",

    longDescription:
      "Upload media to Catbox with Litterbox fallback and manage saved links.",

    category:
      "utility",

    guide:
      "{pn}catbox\n" +
      "{pn}catbox list\n" +
      "{pn}catbox <number>\n" +
      "{pn}catbox clear"
  },


  onStart:
    async function ({
      api,
      event,
      args
    }) {

      const send = msg =>
        api.sendMessage(
          msg,
          event.threadID,
          event.messageID
        );

      try {

        const command =
          String(
            args?.[0] || ""
          ).toLowerCase();


        // ═══════════════════════════════════════
        // LIST
        // ═══════════════════════════════════════

        if (
          command === "list"
        ) {
          return showList(
            api,
            event
          );
        }


        // ═══════════════════════════════════════
        // CLEAR
        // ═══════════════════════════════════════

        if (
          command === "clear"
        ) {

          const store =
            loadStore();

          if (
            !store.length
          ) {
            return send(
              "📭 Catbox store already empty!"
            );
          }

          saveStore([]);

          return send(
            `✅ CATBOX STORE CLEARED\n\n` +
            `🗑️ Deleted: ${store.length} files`
          );
        }


        // ═══════════════════════════════════════
        // DOWNLOAD NUMBER
        // ═══════════════════════════════════════

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

          if (
            !store.length
          ) {
            return send(
              "📭 Catbox store empty!"
            );
          }

          if (
            number < 1 ||
            number > store.length
          ) {
            return send(
              `❌ Invalid number!\n\n` +
              `📌 Available: 1 - ${store.length}`
            );
          }

          const item =
            store[
              number - 1
            ];

          return downloadSavedFile(
            api,
            event,
            item
          );
        }


        // ═══════════════════════════════════════
        // CHECK REPLY
        // ═══════════════════════════════════════

        if (
          !event.messageReply
        ) {

          return send(
            `🐱 CATBOX\n\n` +

            `📤 Upload:\n` +
            `Media-তে reply করে catbox\n\n` +

            `📋 List:\n` +
            `catbox list\n\n` +

            `📥 Download:\n` +
            `catbox 1\n` +
            `অথবা list message-এ reply করে 1\n\n` +

            `🗑️ Clear:\n` +
            `catbox clear`
          );
        }


        // ═══════════════════════════════════════
        // ATTACHMENT
        // ═══════════════════════════════════════

        const attachments =
          event.messageReply
            .attachments || [];

        if (
          !attachments.length
        ) {
          return send(
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
          return send(
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
        // DOWNLOAD FACEBOOK FILE
        // ═══════════════════════════════════════

        await send(
          `${emoji} Media detected!\n` +
          `⏳ Media download করছি...`
        );

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


        // ═══════════════════════════════════════
        // CONTENT TYPE
        // ═══════════════════════════════════════

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


        // ═══════════════════════════════════════
        // FILENAME
        // ═══════════════════════════════════════

        const extension =
          getExtension(
            contentType,
            mediaType
          );

        const filename =
          `facebook_${Date.now()}.${extension}`;


        // ═══════════════════════════════════════
        // UPLOAD
        // ═══════════════════════════════════════

        let url;
        let host;

        // ───────────────────────────────────────
        // TRY CATBOX
        // ───────────────────────────────────────

        try {

          await send(
            `${emoji} Catbox-এ upload করছি...`
          );

          url =
            await uploadToCatbox(
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

          // ─────────────────────────────────────
          // FALLBACK LITTERBOX
          // ─────────────────────────────────────

          await send(
            `⚠️ Catbox upload failed!\n\n` +
            `📛 ${catboxError.message}\n\n` +
            `🔄 Litterbox fallback দিয়ে চেষ্টা করছি...`
          );

          try {

            url =
              await uploadToLitterbox(
                buffer,
                filename,
                contentType
              );

            host =
              "Litterbox";

          } catch (litterError) {

            console.error(
              "[LITTERBOX FAILED]",
              litterError.message
            );

            throw new Error(
              `Catbox: ${catboxError.message}\n` +
              `Litterbox: ${litterError.message}`
            );
          }
        }


        // ═══════════════════════════════════════
        // DUPLICATE
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

          return send(
            `╭────────────────╮\n` +
            `     🐱 ${host.toUpperCase()}\n` +
            `╰────────────────╯\n\n` +

            `${emoji} Type: ${mediaType}\n` +
            `📦 Size: ${formatBytes(buffer.length)}\n` +
            `🔢 Serial: #${duplicate.id}\n\n` +

            `🔗 ${url}\n\n` +

            `♻️ এই link আগে থেকেই store-এ আছে।`
          );
        }


        // ═══════════════════════════════════════
        // SAVE
        // ═══════════════════════════════════════

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
        // SUCCESS
        // ═══════════════════════════════════════

        let expiryText =
          "";

        if (
          host ===
          "Litterbox"
        ) {
          expiryText =
            `\n⏳ Expiry: 72 hours`;
        }

        return send(
          `╭────────────────╮\n` +
          `     🐱 ${host.toUpperCase()}\n` +
          `╰────────────────╯\n\n` +

          `${emoji} Type: ${mediaType}\n` +
          `📦 Size: ${formatBytes(buffer.length)}\n` +
          `🔢 Serial: #${item.id}\n` +
          `🌐 Host: ${host}` +
          expiryText +
          `\n\n` +

          `🔗 ${url}\n\n` +

          `💾 Store-এ save হয়েছে!\n` +
          `✅ Upload Successful!`
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

        return send(
          `❌ UPLOAD FAILED\n\n` +
          `📛 Error:\n${reason}\n\n` +
          `🔄 আবার চেষ্টা করো।`
        );
      }
    }
};