const axios = require("axios");
const FormData = require("form-data");

const CATBOX_API =
  "https://catbox.moe/user/api.php";

const LITTERBOX_API =
  "https://litterbox.catbox.moe/resources/internals/api.php";

const STORE_KEY = "catbox";

/* =========================================================
 * GLOBAL DATA
 * ========================================================= */

function getFiles(globalData) {
  try {
    if (!globalData) return [];

    const data = globalData.get(
      STORE_KEY,
      "data",
      {}
    );

    if (!data || typeof data !== "object") {
      return [];
    }

    return Array.isArray(data.files)
      ? data.files
      : [];
  } catch (error) {
    console.error(
      "[CATBOX] getFiles:",
      error.message
    );
    return [];
  }
}

async function setFiles(globalData, files) {
  if (!globalData) {
    throw new Error(
      "globalData is not available"
    );
  }

  if (globalData.existsSync(STORE_KEY)) {
    await globalData.set(
      STORE_KEY,
      files,
      "data.files"
    );
  } else {
    await globalData.create(
      STORE_KEY,
      {
        data: {
          files
        }
      }
    );
  }
}

/* =========================================================
 * HELPERS
 * ========================================================= */

function formatSize(bytes) {
  if (!bytes || bytes <= 0) {
    return "Unknown";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB"
  ];

  let size = bytes;
  let index = 0;

  while (
    size >= 1024 &&
    index < units.length - 1
  ) {
    size /= 1024;
    index++;
  }

  return `${size.toFixed(
    index === 0 ? 0 : 2
  )} ${units[index]}`;
}

function getIcon(type, filename) {
  const value =
    `${type || ""} ${filename || ""}`
      .toLowerCase();

  if (
    value.includes("video") ||
    /\.(mp4|mkv|avi|mov|webm|m4v)$/i.test(
      filename || ""
    )
  ) {
    return "🎬";
  }

  if (
    value.includes("audio") ||
    /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(
      filename || ""
    )
  ) {
    return "🎵";
  }

  if (
    value.includes("image") ||
    /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(
      filename || ""
    )
  ) {
    return "🖼️";
  }

  return "📁";
}

function cleanFilename(filename) {
  return String(filename || "file")
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      "_"
    )
    .trim() || "file";
}

function getExtension(
  filename,
  contentType
) {
  const match = String(
    filename || ""
  ).match(/\.([a-z0-9]+)$/i);

  if (match) {
    return match[1].toLowerCase();
  }

  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "application/pdf": "pdf"
  };

  return (
    map[
      String(contentType || "")
        .toLowerCase()
    ] || "bin"
  );
}

async function editStatus(
  api,
  messageID,
  text
) {
  try {
    if (api?.editMessage) {
      await api.editMessage(
        text,
        messageID
      );
      return true;
    }
  } catch (error) {
    console.error(
      "[CATBOX] edit:",
      error.message
    );
  }

  return false;
}

/* =========================================================
 * CATBOX UPLOAD
 * ========================================================= */

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
      filename: cleanFilename(filename),
      contentType:
        contentType ||
        "application/octet-stream"
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
          Accept:
            "text/plain,*/*"
        },

        timeout: 120000,

        maxContentLength:
          Infinity,

        maxBodyLength:
          Infinity,

        responseType: "text",

        validateStatus:
          () => true
      }
    );

  const result =
    String(
      response.data || ""
    ).trim();

  if (
    response.status >= 200 &&
    response.status < 300 &&
    /^https?:\/\//i.test(result)
  ) {
    return result;
  }

  throw new Error(
    result ||
      `Catbox HTTP ${response.status}`
  );
}

/* =========================================================
 * LITTERBOX FALLBACK
 * ========================================================= */

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
      filename: cleanFilename(filename),
      contentType:
        contentType ||
        "application/octet-stream"
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
          Accept:
            "text/plain,*/*"
        },

        timeout: 120000,

        maxContentLength:
          Infinity,

        maxBodyLength:
          Infinity,

        responseType: "text",

        validateStatus:
          () => true
      }
    );

  const result =
    String(
      response.data || ""
    ).trim();

  if (
    response.status >= 200 &&
    response.status < 300 &&
    /^https?:\/\//i.test(result)
  ) {
    return result;
  }

  throw new Error(
    result ||
      `Litterbox HTTP ${response.status}`
  );
}

/* =========================================================
 * DOWNLOAD + SEND
 * ========================================================= */

async function downloadFile(
  message,
  url,
  filename,
  contentType
) {
  const response =
    await axios.get(
      url,
      {
        responseType: "stream",

        timeout: 120000,

        maxContentLength:
          Infinity,

        maxBodyLength:
          Infinity,

        headers: {
          "User-Agent":
            "Mozilla/5.0",
          Accept: "*/*"
        }
      }
    );

  await message.reply({
    body:
      `📦 ${filename}\n` +
      `📁 ${
        contentType ||
        "Unknown"
      }`,

    attachment:
      response.data
  });
}

/* =========================================================
 * SHOW LIST
 * ========================================================= */

async function showList({
  event,
  message,
  globalData,
  commandName
}) {
  const files =
    getFiles(globalData);

  if (!files.length) {
    return message.reply(
      "📦 CATBOX LIST\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "❌ কোনো file save করা নেই!"
    );
  }

  let text =
    "📦 CATBOX FILE LIST\n" +
    "━━━━━━━━━━━━━━━━━━\n\n";

  files.forEach(
    (file, index) => {
      const number =
        index + 1;

      const icon =
        getIcon(
          file.contentType ||
            file.type,
          file.filename
        );

      text +=
        `${number}. ${icon} ${
          file.filename ||
          "Unknown"
        }\n`;

      text +=
        `   📦 ${
          file.size ||
          formatSize(file.bytes)
        }\n`;

      text +=
        `   🌐 ${
          file.host ||
          "catbox"
        }\n`;

      text +=
        `   🔗 ${file.url}\n\n`;
    }
  );

  text +=
    "━━━━━━━━━━━━━━━━━━\n";

  text +=
    "💡 এই message-এ reply করে শুধু number পাঠান।\n";

  text +=
    "উদাহরণ: 1";

  const sent =
    await message.reply(text);

  global.GoatBot.onReply.set(
    sent.messageID,
    {
      commandName,
      author:
        event.senderID,

      results: files
    }
  );
}

/* =========================================================
 * REPLY DOWNLOAD
 * ========================================================= */

async function handleReply({
  api,
  event,
  message,
  globalData
}) {
  const replyMessageID =
    event.messageReply?.messageID;

  if (!replyMessageID) {
    return;
  }

  const replyData =
    global.GoatBot.onReply.get(
      replyMessageID
    );

  if (!replyData) {
    return;
  }

  if (
    event.senderID !==
    replyData.author
  ) {
    return message.reply(
      "❌ এই list থেকে file নেওয়ার permission আপনার নেই!"
    );
  }

  const input =
    String(
      event.body || ""
    ).trim();

  if (!/^\d+$/.test(input)) {
    return message.reply(
      "❌ শুধু file number পাঠান!\n\n" +
      "উদাহরণ: 1"
    );
  }

  const number =
    parseInt(input, 10);

  const files =
    getFiles(globalData);

  if (!files.length) {
    global.GoatBot.onReply.delete(
      replyMessageID
    );

    return message.reply(
      "❌ Catbox list এখন empty!"
    );
  }

  if (
    number < 1 ||
    number > files.length
  ) {
    return message.reply(
      `❌ Invalid number!\n\n` +
      `📦 মোট file: ${files.length}`
    );
  }

  const file =
    files[number - 1];

  /*
   * Reply handler remove
   */
  global.GoatBot.onReply.delete(
    replyMessageID
  );

  /*
   * List message delete
   */
  try {
    await api.unsendMessage(
      replyMessageID
    );
  } catch {
    try {
      await message.unsend(
        replyMessageID,
        event.threadID
      );
    } catch {}
  }

  let status;

  try {
    status =
      await message.reply(
        `⏳ Downloading file #${number}...\n\n` +
        `📁 ${
          file.filename ||
          "Unknown"
        }`
      );

    await downloadFile(
      message,
      file.url,
      file.filename ||
        `catbox-${number}.${file.extension || "bin"}`,
      file.contentType ||
        file.type
    );

    /*
     * Download success হলে
     * status message delete
     */
    if (status?.messageID) {
      try {
        await message.unsend(
          status.messageID,
          event.threadID
        );
      } catch {}
    }
  } catch (error) {
    const errorText =
      error?.response?.data ||
      error?.message ||
      String(error);

    if (status?.messageID) {
      await editStatus(
        api,
        status.messageID,
        `❌ Download failed!\n\n${errorText}`
      );
    } else {
      await message.reply(
        `❌ Download failed!\n\n${errorText}`
      );
    }
  }
}

/* =========================================================
 * COMMAND
 * ========================================================= */

module.exports = {
  config: {
    name: "catbox",

    aliases: [
      "cat"
    ],

    version: "6.0",

    author: "Rakib",

    countDown: 5,

    role: 0,

    category: "utility",

    shortDescription: {
      en:
        "Upload and manage Catbox files"
    },

    longDescription: {
      en:
        "Upload files to Catbox, save links and download them later"
    },

    guide: {
      en:
        "{pn}\n" +
        "{pn} list\n" +
        "{pn} clear 1\n" +
        "{pn} clear all"
    }
  },

  /* =======================================================
   * ON START
   * ======================================================= */

  onStart: async function ({
    api,
    event,
    message,
    args,
    globalData
  }) {

    /*
     * ================================================
     * LIST
     * ================================================
     */

    if (
      args[0] &&
      args[0].toLowerCase() ===
        "list"
    ) {
      return showList({
        event,
        message,
        globalData,
        commandName:
          this.config.name
      });
    }

    /*
     * ================================================
     * CLEAR
     * ================================================
     */

    if (
      args[0] &&
      args[0].toLowerCase() ===
        "clear"
    ) {
      const target =
        args[1]?.toLowerCase();

      if (!target) {
        return message.reply(
          "❌ ব্যবহার:\n\n" +
          "catbox clear 1\n" +
          "catbox clear all"
        );
      }

      const files =
        getFiles(globalData);

      if (!files.length) {
        return message.reply(
          "❌ Catbox list এ কোনো file নেই!"
        );
      }

      /*
       * CLEAR ALL
       */

      if (
        target === "all"
      ) {
        await setFiles(
          globalData,
          []
        );

        return message.reply(
          `✅ সব Catbox file clear হয়েছে!\n\n` +
          `🗑️ Deleted: ${files.length} files`
        );
      }

      /*
       * CLEAR ONE
       */

      const number =
        parseInt(
          target,
          10
        );

      if (
        isNaN(number) ||
        number < 1 ||
        number > files.length
      ) {
        return message.reply(
          `❌ Invalid number!\n\n` +
          `📦 মোট file: ${files.length}\n\n` +
          `উদাহরণ:\n` +
          `catbox clear 1\n` +
          `catbox clear all`
        );
      }

      const removed =
        files[number - 1];

      files.splice(
        number - 1,
        1
      );

      /*
       * Serial ঠিক করা
       */

      files.forEach(
        (file, index) => {
          file.id =
            index + 1;
        }
      );

      await setFiles(
        globalData,
        files
      );

      return message.reply(
        `✅ File #${number} clear হয়েছে!\n\n` +
        `📁 ${
          removed.filename ||
          "Unknown"
        }\n` +
        `🔗 ${removed.url}\n\n` +
        `📦 বাকি: ${files.length}টি`
      );
    }

    /*
     * ================================================
     * REPLY TO LIST
     * ================================================
     */

    if (
      event.messageReply
    ) {
      const replyData =
        global.GoatBot.onReply.get(
          event.messageReply
            .messageID
        );

      if (replyData) {
        return handleReply({
          api,
          event,
          message,
          globalData
        });
      }
    }

    /*
     * ================================================
     * UPLOAD
     * ================================================
     */

    const attachments =
      event.messageReply
        ?.attachments || [];

    if (!attachments.length) {
      return message.reply(
        "📦 CATBOX\n" +
        "━━━━━━━━━━━━━━━━━━\n\n" +

        "📤 Upload:\n" +
        "কোনো photo/video/audio/file-এ reply করে `catbox` লিখুন।\n\n" +

        "📋 List:\n" +
        "`catbox list`\n\n" +

        "🗑️ একটি delete:\n" +
        "`catbox clear 1`\n\n" +

        "🗑️ সব delete:\n" +
        "`catbox clear all`"
      );
    }

    let status;

    try {
      status =
        await message.reply(
          "⏳ Processing attachment..."
        );

      const uploaded = [];

      /*
       * বর্তমান database files
       */

      let files =
        getFiles(globalData);

      for (
        let i = 0;
        i < attachments.length;
        i++
      ) {
        const attachment =
          attachments[i];

        if (!attachment.url) {
          continue;
        }

        await editStatus(
          api,
          status.messageID,
          `⏳ Downloading ${i + 1}/${attachments.length}...`
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
                  "Mozilla/5.0",

                Accept:
                  "*/*"
              }
            }
          );

        const buffer =
          Buffer.from(
            response.data
          );

        const contentType =
          attachment.type ||
          response.headers[
            "content-type"
          ] ||
          "application/octet-stream";

        let filename =
          attachment.name ||
          attachment.filename ||
          `catbox-${Date.now()}-${i + 1}`;

        filename =
          cleanFilename(
            filename
          );

        const extension =
          getExtension(
            filename,
            contentType
          );

        if (
          !/\.[a-z0-9]+$/i.test(
            filename
          )
        ) {
          filename +=
            `.${extension}`;
        }

        await editStatus(
          api,
          status.messageID,
          `⏳ Uploading ${i + 1}/${attachments.length}...`
        );

        let url;
        let host =
          "catbox";

        /*
         * CATBOX
         */

        try {
          url =
            await uploadCatbox(
              buffer,
              filename,
              contentType
            );
        } catch (
          catboxError
        ) {

          /*
           * LITTERBOX FALLBACK
           */

          await editStatus(
            api,
            status.messageID,
            "⚠️ Catbox upload failed.\n\n🔄 Trying Litterbox..."
          );

          url =
            await uploadLitterbox(
              buffer,
              filename,
              contentType
            );

          host =
            "litterbox";
        }

        uploaded.push({
          id:
            files.length +
            uploaded.length +
            1,

          url,

          host,

          filename,

          extension,

          type:
            contentType,

          contentType,

          bytes:
            buffer.length,

          size:
            formatSize(
              buffer.length
            ),

          uploadedAt:
            new Date().toISOString()
        });
      }

      if (!uploaded.length) {
        throw new Error(
          "No valid attachment found."
        );
      }

      /*
       * SAVE
       */

      files = [
        ...files,
        ...uploaded
      ];

      /*
       * Serial ঠিক করা
       */

      files.forEach(
        (file, index) => {
          file.id =
            index + 1;
        }
      );

      await setFiles(
        globalData,
        files
      );

      /*
       * RESULT
       */

      let result =
        "✅ CATBOX UPLOAD COMPLETE!\n" +
        "━━━━━━━━━━━━━━━━━━\n\n";

      uploaded.forEach(
        (file, index) => {
          result +=
            `${index + 1}. ${
              getIcon(
                file.contentType,
                file.filename
              )
            } ${file.filename}\n`;

          result +=
            `📦 ${file.size}\n`;

          result +=
            `🌐 ${file.host}\n`;

          result +=
            `🔗 ${file.url}\n\n`;
        }
      );

      result +=
        "━━━━━━━━━━━━━━━━━━\n";

      result +=
        `💾 Total saved: ${files.length}`;

      await editStatus(
        api,
        status.messageID,
        result
      );

    } catch (error) {
      const errorText =
        error?.response?.data ||
        error?.message ||
        String(error);

      if (
        status?.messageID
      ) {
        await editStatus(
          api,
          status.messageID,
          `❌ Catbox upload failed!\n\n${errorText}`
        );
      } else {
        await message.reply(
          `❌ Catbox upload failed!\n\n${errorText}`
        );
      }
    }
  },

  /* =======================================================
   * ON REPLY
   * ======================================================= */

  onReply: async function ({
    api,
    event,
    message,
    globalData
  }) {
    return handleReply({
      api,
      event,
      message,
      globalData
    });
  }
};