const axios = require("axios");
const FormData = require("form-data");

const CATBOX_API = "https://catbox.moe/user/api.php";
const LITTERBOX_API = "https://litterbox.catbox.moe/resources/internals/api.php";

function getStore(globalData) {
  if (!globalData) return [];

  try {
    const files = globalData.get("catbox", "data.files", []);
    return Array.isArray(files) ? files : [];
  } catch {
    return [];
  }
}

async function saveStore(globalData, files) {
  if (!globalData) {
    throw new Error("globalData unavailable");
  }

  if (globalData.existsSync("catbox")) {
    await globalData.set("catbox", files, "data.files");
  } else {
    await globalData.create("catbox", {
      data: {
        files
      }
    });
  }
}

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return "Unknown";

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let i = 0;

  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }

  return `${size.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function getMediaIcon(type = "", filename = "") {
  const value = `${type} ${filename}`.toLowerCase();

  if (value.includes("video") || /\.(mp4|mkv|avi|mov|webm|m4v)$/i.test(filename)) {
    return "🎬";
  }

  if (
    value.includes("audio") ||
    /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(filename)
  ) {
    return "🎵";
  }

  if (
    value.includes("image") ||
    /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filename)
  ) {
    return "🖼️";
  }

  return "📁";
}

function getExtension(filename = "", contentType = "") {
  const ext = filename.match(/\.([a-z0-9]+)$/i);

  if (ext) {
    return ext[1].toLowerCase();
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

  return map[contentType?.toLowerCase()] || "bin";
}

function cleanFilename(filename = "file") {
  return String(filename)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim() || "file";
}

async function editStatus(api, messageID, text) {
  try {
    if (api?.editMessage) {
      await api.editMessage(text, messageID);
      return true;
    }
  } catch {}

  return false;
}

async function uploadCatbox(buffer, filename, contentType) {
  const form = new FormData();

  form.append("reqtype", "fileupload");

  form.append("fileToUpload", buffer, {
    filename: cleanFilename(filename),
    contentType: contentType || "application/octet-stream"
  });

  const response = await axios.post(CATBOX_API, form, {
    headers: {
      ...form.getHeaders(),
      "User-Agent": "Mozilla/5.0",
      Accept: "text/plain,*/*"
    },
    timeout: 120000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    responseType: "text",
    validateStatus: () => true
  });

  const result = String(response.data || "").trim();

  if (
    response.status >= 200 &&
    response.status < 300 &&
    /^https?:\/\//i.test(result)
  ) {
    return result;
  }

  throw new Error(
    result || `Catbox HTTP ${response.status}`
  );
}

async function uploadLitterbox(buffer, filename, contentType) {
  const form = new FormData();

  form.append("reqtype", "fileupload");
  form.append("time", "72h");

  form.append("fileToUpload", buffer, {
    filename: cleanFilename(filename),
    contentType: contentType || "application/octet-stream"
  });

  const response = await axios.post(LITTERBOX_API, form, {
    headers: {
      ...form.getHeaders(),
      "User-Agent": "Mozilla/5.0",
      Accept: "text/plain,*/*"
    },
    timeout: 120000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    responseType: "text",
    validateStatus: () => true
  });

  const result = String(response.data || "").trim();

  if (
    response.status >= 200 &&
    response.status < 300 &&
    /^https?:\/\//i.test(result)
  ) {
    return result;
  }

  throw new Error(
    result || `Litterbox HTTP ${response.status}`
  );
}

async function downloadAndSend(api, message, url, filename, contentType) {
  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 120000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "*/*"
    }
  });

  await message.reply({
    body:
      `📦 ${filename || "Catbox File"}\n` +
      `📁 ${contentType || "Unknown"}`,
    attachment: response.data
  });
}

async function showList({ event, message, globalData }) {
  const files = getStore(globalData);

  if (!files.length) {
    return message.reply(
      "📦 Catbox List\n\n❌ কোনো file save করা নেই!"
    );
  }

  let text = "📦 CATBOX FILE LIST\n";
  text += "━━━━━━━━━━━━━━━━━━\n\n";

  files.forEach((file, index) => {
    const number = index + 1;
    const icon = getMediaIcon(file.type, file.filename);

    text += `${number}. ${icon} ${file.filename || "Unknown"}\n`;
    text += `   📦 ${formatSize(file.bytes)}\n`;
    text += `   🔗 ${file.url}\n\n`;
  });

  text += "━━━━━━━━━━━━━━━━━━\n";
  text += "💡 Reply করে শুধু number পাঠান।\n";
  text += "উদাহরণ: 1";

  const sent = await message.reply(text);

  global.GoatBot.onReply.set(sent.messageID, {
    commandName: this.config.name,
    author: event.senderID,
    results: files
  });
}

async function handleReply({
  event,
  message,
  api,
  globalData
}) {
  if (!event.messageReply) return;

  const replyData = global.GoatBot.onReply.get(
    event.messageReply.messageID
  );

  if (!replyData) return;

  if (event.senderID !== replyData.author) {
    return message.reply(
      "❌ এই list থেকে file নেওয়ার permission আপনার নেই!"
    );
  }

  const input = String(event.body || "").trim();

  if (!/^\d+$/.test(input)) {
    return message.reply(
      "❌ শুধু file number পাঠান!\n\nউদাহরণ: 1"
    );
  }

  const number = parseInt(input, 10);

  const files = getStore(globalData);

  if (!files.length) {
    global.GoatBot.onReply.delete(
      event.messageReply.messageID
    );

    return message.reply(
      "❌ Catbox list এখন empty!"
    );
  }

  if (number < 1 || number > files.length) {
    return message.reply(
      `❌ Invalid number!\n\n📦 মোট file: ${files.length}`
    );
  }

  const file = files[number - 1];

  global.GoatBot.onReply.delete(
    event.messageReply.messageID
  );

  // List message delete
  try {
    await api.unsendMessage(
      event.messageReply.messageID
    );
  } catch {
    try {
      await message.unsend(
        event.messageReply.messageID,
        event.threadID
      );
    } catch {}
  }

  let status;

  try {
    status = await message.reply(
      `⏳ Downloading file #${number}...\n\n` +
      `📁 ${file.filename || "Unknown"}`
    );

    await downloadAndSend(
      api,
      message,
      file.url,
      file.filename || `catbox-${number}.${file.extension || "bin"}`,
      file.contentType || file.type
    );

    try {
      await message.unsend(
        status.messageID,
        event.threadID
      );
    } catch {}
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

module.exports = {
  config: {
    name: "catbox",
    aliases: ["cat"],
    version: "5.0",
    author: "Rakib",
    countDown: 5,
    role: 0,
    category: "utility",
    shortDescription: {
      en: "Upload and manage Catbox files"
    },
    longDescription: {
      en: "Upload attachments to Catbox and manage saved links"
    },
    guide: {
      en:
        "{pn} — reply to media/file and upload\n" +
        "{pn} list — show saved files\n" +
        "{pn} clear 1 — delete file #1\n" +
        "{pn} clear all — delete all files"
    }
  },

  onStart: async function ({
    api,
    event,
    message,
    args,
    globalData
  }) {
    // =========================
    // CATBOX LIST
    // =========================
    if (
      args[0] &&
      args[0].toLowerCase() === "list"
    ) {
      return showList.call(this, {
        event,
        message,
        globalData
      });
    }

    // =========================
    // CATBOX CLEAR
    // =========================
    if (
      args[0] &&
      args[0].toLowerCase() === "clear"
    ) {
      const target = args[1]?.toLowerCase();

      if (!target) {
        return message.reply(
          "❌ ব্যবহার:\n\n" +
          "catbox clear 1\n" +
          "catbox clear all"
        );
      }

      const files = getStore(globalData);

      if (!files.length) {
        return message.reply(
          "❌ Catbox list এ কোনো file নেই!"
        );
      }

      // =========================
      // CLEAR ALL
      // =========================
      if (target === "all") {
        await saveStore(globalData, []);

        return message.reply(
          `✅ সব Catbox file clear করা হয়েছে!\n\n` +
          `🗑️ Deleted: ${files.length} files`
        );
      }

      // =========================
      // CLEAR SINGLE
      // =========================
      const index = parseInt(target, 10);

      if (
        isNaN(index) ||
        index < 1 ||
        index > files.length
      ) {
        return message.reply(
          `❌ Invalid number!\n\n` +
          `📦 মোট file: ${files.length}\n\n` +
          `উদাহরণ:\n` +
          `catbox clear 1\n` +
          `catbox clear all`
        );
      }

      const removed = files[index - 1];

      files.splice(index - 1, 1);

      // Serial নতুন করে 1,2,3...
      files.forEach((file, i) => {
        file.id = i + 1;
      });

      await saveStore(globalData, files);

      return message.reply(
        `✅ File #${index} clear হয়েছে!\n\n` +
        `📁 ${removed.filename || "Unknown"}\n` +
        `🔗 ${removed.url}\n\n` +
        `📦 বাকি আছে: ${files.length}টি`
      );
    }

    // =========================
    // REPLY DOWNLOAD
    // =========================
    if (event.messageReply) {
      const replyData = global.GoatBot.onReply.get(
        event.messageReply.messageID
      );

      if (replyData) {
        return handleReply({
          event,
          message,
          api,
          globalData
        });
      }
    }

    // =========================
    // UPLOAD
    // =========================
    const attachments =
      event.messageReply?.attachments || [];

    if (!attachments.length) {
      return message.reply(
        "📦 Catbox\n\n" +
        "ব্যবহার:\n\n" +
        "1️⃣ কোনো photo/video/audio/file-এ reply করে:\n" +
        "catbox\n\n" +
        "2️⃣ List দেখতে:\n" +
        "catbox list\n\n" +
        "3️⃣ নির্দিষ্ট file delete:\n" +
        "catbox clear 1\n\n" +
        "4️⃣ সব file delete:\n" +
        "catbox clear all"
      );
    }

    let status;

    try {
      status = await message.reply(
        "⏳ Processing attachment..."
      );

      const uploadedFiles = [];
      const oldFiles = getStore(globalData);

      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];

        if (!attachment.url) {
          continue;
        }

        await editStatus(
          api,
          status.messageID,
          `⏳ Downloading attachment ${i + 1}/${attachments.length}...`
        );

        const response = await axios.get(
          attachment.url,
          {
            responseType: "arraybuffer",
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
              "User-Agent": "Mozilla/5.0",
              Accept: "*/*"
            }
          }
        );

        const buffer = Buffer.from(
          response.data
        );

        const contentType =
          attachment.type ||
          response.headers["content-type"] ||
          "application/octet-stream";

        let filename =
          attachment.name ||
          attachment.filename ||
          `catbox-${Date.now()}-${i + 1}`;

        filename = cleanFilename(filename);

        const extension = getExtension(
          filename,
          contentType
        );

        if (!/\.[a-z0-9]+$/i.test(filename)) {
          filename += `.${extension}`;
        }

        await editStatus(
          api,
          status.messageID,
          `⏳ Uploading ${i + 1}/${attachments.length} to Catbox...`
        );

        let url;
        let host = "catbox";

        try {
          url = await uploadCatbox(
            buffer,
            filename,
            contentType
          );
        } catch (catboxError) {
          await editStatus(
            api,
            status.messageID,
            `⚠️ Catbox upload failed.\n\n` +
            `🔄 Trying Litterbox fallback...`
          );

          url = await uploadLitterbox(
            buffer,
            filename,
            contentType
          );

          host = "litterbox";
        }

        uploadedFiles.push({
          id: oldFiles.length + uploadedFiles.length + 1,
          url,
          host,
          type: contentType,
          size: formatSize(buffer.length),
          bytes: buffer.length,
          filename,
          extension,
          contentType,
          uploadedAt: new Date().toISOString()
        });
      }

      if (!uploadedFiles.length) {
        throw new Error(
          "No valid attachment found."
        );
      }

      const currentFiles = getStore(globalData);

      const finalFiles = [
        ...currentFiles,
        ...uploadedFiles
      ];

      // Serial ঠিক করা
      finalFiles.forEach((file, index) => {
        file.id = index + 1;
      });

      await saveStore(
        globalData,
        finalFiles
      );

      let result = "✅ CATBOX UPLOAD COMPLETE!\n";
      result += "━━━━━━━━━━━━━━━━━━\n\n";

      uploadedFiles.forEach((file, index) => {
        result += `${index + 1}. ${getMediaIcon(
          file.type,
          file.filename
        )} ${file.filename}\n`;
        result += `📦 ${file.size}\n`;
        result += `🌐 ${file.host}\n`;
        result += `🔗 ${file.url}\n\n`;
      });

      result += "━━━━━━━━━━━━━━━━━━\n";
      result += `💾 Total saved: ${finalFiles.length}`;

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

      if (status?.messageID) {
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