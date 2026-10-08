const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

const API_CONFIG_URL =
  "https://raw.githubusercontent.com/bdrakib6t9/HOON/main/apiUrl.json";

let API_BASE_URL = null;

/*
 * =====================================================
 * API URL
 * =====================================================
 */

async function getPhoneApiUrl() {
  if (API_BASE_URL) return API_BASE_URL;

  const response = await axios.get(API_CONFIG_URL, {
    timeout: 15000
  });

  const phoneApi = response.data?.phone;

  if (!phoneApi) {
    throw new Error("Phone API URL not found in apiUrl.json");
  }

  API_BASE_URL = phoneApi.replace(/\/+$/, "");

  return API_BASE_URL;
}

/*
 * =====================================================
 * HELPERS
 * =====================================================
 */

function formatPrice(price) {
  if (
    price === null ||
    price === undefined ||
    price === "" ||
    Number(price) === 0
  ) {
    return null;
  }

  const num = Number(price);

  if (Number.isNaN(num)) {
    return String(price);
  }

  return `৳${num.toLocaleString("en-US")}`;
}

function addLine(obj, key, label, lines) {
  if (
    obj?.[key] !== null &&
    obj?.[key] !== undefined &&
    obj?.[key] !== ""
  ) {
    lines.push(`• ${label}: ${obj[key]}`);
  }
}

/*
 * Normalize model name for exact matching
 *
 * Example:
 * Xiaomi Redmi 10C -> redmi 10c
 * Redmi 10C        -> redmi 10c
 * iPhone 18 Pro Max -> iphone 18 pro max
 */

function normalizeModelName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\w\s.+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * Remove manufacturer prefix only for matching.
 *
 * Xiaomi Redmi 10C -> Redmi 10C
 * Samsung Galaxy S26 Ultra -> Galaxy S26 Ultra
 * Apple iPhone 18 Pro Max -> iPhone 18 Pro Max
 */

function removeBrandPrefix(name) {
  return normalizeModelName(name)
    .replace(/^xiaomi\s+/i, "")
    .replace(/^samsung\s+/i, "")
    .replace(/^apple\s+/i, "")
    .replace(/^huawei\s+/i, "")
    .replace(/^honor\s+/i, "")
    .replace(/^oneplus\s+/i, "")
    .replace(/^oppo\s+/i, "")
    .replace(/^vivo\s+/i, "")
    .replace(/^realme\s+/i, "")
    .replace(/^motorola\s+/i, "")
    .replace(/^nokia\s+/i, "")
    .replace(/^google\s+/i, "")
    .replace(/^tecno\s+/i, "")
    .replace(/^infinix\s+/i, "")
    .replace(/^itel\s+/i, "")
    .trim();
}

/*
 * Check whether API returned the exact requested model.
 *
 * redmi 10c
 * Xiaomi Redmi 10C
 *
 * => true
 *
 * iphone 18 pro max
 * iPhone 16 Pro Max
 *
 * => false
 */

function isExactModel(query, apiName) {
  const q = removeBrandPrefix(query);
  const name = removeBrandPrefix(apiName);

  return q === name;
}

/*
 * Get search result display name
 */

function getResultName(phone) {
  return (
    phone?.name ||
    phone?.model ||
    phone?.title ||
    phone?.phone ||
    phone?.device ||
    phone?.slug ||
    "Unknown Phone"
  );
}

/*
 * Get price from API search result.
 *
 * Supports:
 * price
 * price_bd
 * official
 * price_bd.official
 * variants
 */

function getSearchPrice(phone) {
  /*
   * Direct price
   */
  if (
    phone?.price !== undefined &&
    phone?.price !== null &&
    phone?.price !== ""
  ) {
    return phone.price;
  }

  /*
   * price_bd object
   */
  if (phone?.price_bd) {
    if (typeof phone.price_bd === "object") {
      if (phone.price_bd.official) {
        return phone.price_bd.official;
      }

      if (phone.price_bd.unofficial) {
        return phone.price_bd.unofficial;
      }

      if (Array.isArray(phone.price_bd.variants)) {
        const variant = phone.price_bd.variants.find(
          item => item?.price
        );

        if (variant?.price) {
          return variant.price;
        }
      }
    }

    if (typeof phone.price_bd !== "object") {
      return phone.price_bd;
    }
  }

  /*
   * official
   */
  if (phone?.official) {
    return phone.official;
  }

  /*
   * variants
   */
  if (Array.isArray(phone?.variants)) {
    const variant = phone.variants.find(
      item => item?.price
    );

    if (variant?.price) {
      return variant.price;
    }
  }

  return null;
}

/*
 * =====================================================
 * COMMAND
 * =====================================================
 */

module.exports = {
  config: {
    name: "phone",
    aliases: ["mobile", "device", "specs"],
    version: "4.0",
    author: "Rakib",
    countDown: 5,
    role: 0,

    shortDescription: "Phone search & specifications",

    longDescription:
      "Search phones by brand/model and get complete specifications, Bangladesh price, variants and images.",

    category: "utility",

    guide:
      "{pn} redmi\n" +
      "{pn} redmi 10c\n" +
      "{pn} samsung galaxy s26 ultra\n" +
      "{pn} iphone 18 pro max"
  },

  onStart: async function ({ api, event, args }) {
    const query = args.join(" ").trim();

    if (!query) {
      return api.sendMessage(
        "📱 | Please enter a phone name/model.\n\n" +
          "Examples:\n" +
          "• !phone redmi\n" +
          "• !phone redmi 10c\n" +
          "• !phone samsung\n" +
          "• !phone samsung galaxy s26 ultra\n" +
          "• !phone iphone 18 pro max",
        event.threadID,
        event.messageID
      );
    }

    try {
      const API_BASE = await getPhoneApiUrl();

      /*
       * =================================================
       * STEP 1
       * Try direct phone details first.
       *
       * This allows:
       *
       * redmi 10c
       * iphone 18 pro max
       * samsung galaxy s26 ultra
       *
       * to directly open details.
       * =================================================
       */

      let directResult = null;

      try {
        const directResponse = await axios.get(
          `${API_BASE}/api/phone`,
          {
            params: {
              model: query
            },
            timeout: 45000
          }
        );

        if (
          directResponse.data?.success &&
          directResponse.data?.data
        ) {
          const phoneName =
            directResponse.data.data.name || "";

          /*
           * Only accept it when it is actually
           * the requested model.
           */
          if (isExactModel(query, phoneName)) {
            directResult = directResponse.data.data;
          }
        }
      } catch (error) {
        /*
         * Direct lookup failed.
         * That's okay.
         *
         * We will use search below.
         */
      }

      /*
       * =================================================
       * DIRECT DETAILS
       * =================================================
       */

      if (directResult) {
        return await sendPhoneDetails({
          api,
          event,
          API_BASE,
          phone: directResult,
          model: query
        });
      }

      /*
       * =================================================
       * STEP 2
       * GENERAL SEARCH
       * =================================================
       */

      const loading = await api.sendMessage(
        `🔎 Searching phones for "${query}"...`,
        event.threadID
      );

      let response;

      try {
        response = await axios.get(
          `${API_BASE}/api/search`,
          {
            params: {
              q: query
            },
            timeout: 60000
          }
        );
      } catch (error) {
        if (loading?.messageID) {
          try {
            await api.unsendMessage(
              loading.messageID
            );
          } catch {}
        }

        throw error;
      }

      if (loading?.messageID) {
        try {
          await api.unsendMessage(
            loading.messageID
          );
        } catch {}
      }

      const data = response.data;

      /*
       * Supported API formats
       */

      let results =
        data?.results ||
        data?.data ||
        data?.phones ||
        [];

      if (!Array.isArray(results)) {
        results = [];
      }

      if (!results.length) {
        return api.sendMessage(
          `❌ | "${query}" এর কোনো phone পাওয়া যায়নি.\n\n` +
            `অন্য model/brand দিয়ে try করুন।`,
          event.threadID,
          event.messageID
        );
      }

      /*
       * =================================================
       * REMOVE DUPLICATES
       * =================================================
       *
       * API normally already removes duplicates,
       * but we also protect the bot side.
       */

      const unique = new Map();

      for (const phone of results) {
        const name = getResultName(phone);

        const key = normalizeModelName(name);

        if (!key) continue;

        if (!unique.has(key)) {
          unique.set(key, phone);
        }
      }

      results = Array.from(unique.values());

      /*
       * =================================================
       * SEARCH MESSAGE
       * =================================================
       */

      let message = "";

      message += `📱 PHONE SEARCH\n`;
      message += `━━━━━━━━━━━━━━━━━━\n`;
      message += `🔎 Result for: ${query}\n`;
      message += `📊 Found: ${results.length}\n\n`;

      results.forEach((phone, index) => {
        const name = getResultName(phone);

        const rawPrice = getSearchPrice(phone);

        const price = formatPrice(rawPrice);

        if (price) {
          message += `${index + 1}. ${name} — ${price}\n`;
        } else {
          message += `${index + 1}. ${name} — Price unavailable\n`;
        }
      });

      message += `\n━━━━━━━━━━━━━━━━━━\n`;
      message += `💡 নির্দিষ্ট ফোনের details দেখতে:\n`;
      message += `.phone Redmi 10C`;

      /*
       * =================================================
       * SEND SEARCH RESULT
       * =================================================
       */

      return api.sendMessage(
        message,
        event.threadID,
        event.messageID
      );

    } catch (error) {
      console.error(
        "PHONE COMMAND ERROR:",
        error
      );

      return api.sendMessage(
        `❌ | Phone API error.\n\n` +
          `📱 Query: ${query}\n` +
          `⚠️ ${error.message}`,
        event.threadID,
        event.messageID
      );
    }
  }
};


/*
 * =====================================================
 * PHONE DETAILS
 * =====================================================
 */

async function sendPhoneDetails({
  api,
  event,
  API_BASE,
  phone,
  model
}) {
  if (!phone) {
    return api.sendMessage(
      "❌ | Phone model পাওয়া যায়নি।",
      event.threadID,
      event.messageID
    );
  }

  let loading;

  try {
    /*
     * If full phone data was not supplied,
     * fetch it using model.
     */

    if (!phone.specs) {
      loading = await api.sendMessage(
        `🔎 Loading "${model}"...`,
        event.threadID
      );

      const response = await axios.get(
        `${API_BASE}/api/phone`,
        {
          params: {
            model
          },
          timeout: 60000
        }
      );

      if (
        !response.data?.success ||
        !response.data?.data
      ) {
        if (loading?.messageID) {
          try {
            await api.unsendMessage(
              loading.messageID
            );
          } catch {}
        }

        return api.sendMessage(
          `❌ | "${model}" এর details পাওয়া যায়নি।`,
          event.threadID,
          event.messageID
        );
      }

      phone = response.data.data;
    }

    /*
     * Remove loading message
     */

    if (loading?.messageID) {
      try {
        await api.unsendMessage(
          loading.messageID
        );
      } catch {}
    }

    /*
     * =================================================
     * SPECS
     * =================================================
     */

    const general =
      phone.specs?.general || {};

    const network =
      phone.specs?.network || {};

    const display =
      phone.specs?.display || {};

    const platform =
      phone.specs?.platform || {};

    const camera =
      phone.specs?.camera || {};

    const memory =
      phone.specs?.memory || {};

    const battery =
      phone.specs?.battery || {};

    const sensors =
      phone.specs?.sensors || {};

    const multimedia =
      phone.specs?.multimedia || {};

    const body =
      phone.specs?.body || {};

    const price =
      phone.price_bd || {};

    const lines = [];

    /*
     * =================================================
     * HEADER
     * =================================================
     */

    lines.push(
      `📱 ${phone.name || model}`
    );

    lines.push(
      `━━━━━━━━━━━━━━━━━━`
    );

    /*
     * =================================================
     * PRICE
     * =================================================
     */

    lines.push(
      `💰 BANGLADESH PRICE`
    );

    if (price.official) {
      lines.push(
        `• Official: ${formatPrice(
          price.official
        )}`
      );
    }

    if (price.unofficial) {
      lines.push(
        `• Unofficial: ${formatPrice(
          price.unofficial
        )}`
      );
    }

    if (
      Array.isArray(price.variants) &&
      price.variants.length
    ) {
      for (const variant of price.variants) {
        if (
          variant.ram &&
          variant.storage &&
          variant.price
        ) {
          lines.push(
            `• ${variant.ram} + ${variant.storage}: ${formatPrice(
              variant.price
            )}`
          );
        }
      }
    }

    /*
     * =================================================
     * GENERAL
     * =================================================
     */

    lines.push(`\n📋 GENERAL`);

    addLine(
      general,
      "brand",
      "Brand",
      lines
    );

    addLine(
      general,
      "model",
      "Model",
      lines
    );

    addLine(
      general,
      "release_date",
      "Release",
      lines
    );

    addLine(
      general,
      "status",
      "Status",
      lines
    );

    addLine(
      general,
      "made_by",
      "Made in",
      lines
    );

    /*
     * =================================================
     * DISPLAY
     * =================================================
     */

    lines.push(`\n🖥️ DISPLAY`);

    addLine(
      display,
      "type",
      "Type",
      lines
    );

    addLine(
      display,
      "size",
      "Size",
      lines
    );

    addLine(
      display,
      "resolution",
      "Resolution",
      lines
    );

    addLine(
      display,
      "pixel_density",
      "Density",
      lines
    );

    addLine(
      display,
      "refresh_rate",
      "Refresh Rate",
      lines
    );

    addLine(
      display,
      "protection",
      "Protection",
      lines
    );

    addLine(
      display,
      "brightness",
      "Brightness",
      lines
    );

    /*
     * =================================================
     * PERFORMANCE
     * =================================================
     */

    lines.push(`\n⚙️ PERFORMANCE`);

    if (platform.os) {
      lines.push(
        `• OS: ${platform.os}${
          platform.os_version
            ? ` ${platform.os_version}`
            : ""
        }`
      );
    }

    addLine(
      platform,
      "ui",
      "UI",
      lines
    );

    addLine(
      platform,
      "chipset",
      "Chipset",
      lines
    );

    addLine(
      platform,
      "cpu",
      "CPU",
      lines
    );

    addLine(
      platform,
      "gpu",
      "GPU",
      lines
    );

    addLine(
      platform,
      "architecture",
      "Architecture",
      lines
    );

    addLine(
      platform,
      "fabrication",
      "Fabrication",
      lines
    );

    /*
     * =================================================
     * MEMORY
     * =================================================
     */

    lines.push(`\n💾 MEMORY`);

    addLine(
      memory,
      "ram",
      "RAM",
      lines
    );

    addLine(
      memory,
      "ram_type",
      "RAM Type",
      lines
    );

    addLine(
      memory,
      "storage",
      "Storage",
      lines
    );

    addLine(
      memory,
      "storage_type",
      "Storage Type",
      lines
    );

    addLine(
      memory,
      "expandable",
      "Expandable",
      lines
    );

    addLine(
      memory,
      "otg",
      "OTG",
      lines
    );

    /*
     * =================================================
     * CAMERA
     * =================================================
     */

    lines.push(`\n📸 CAMERA`);

    addLine(
      camera,
      "main_setup",
      "Main",
      lines
    );

    addLine(
      camera,
      "main_resolution",
      "Resolution",
      lines
    );

    addLine(
      camera,
      "aperture",
      "Aperture",
      lines
    );

    addLine(
      camera,
      "autofocus",
      "Autofocus",
      lines
    );

    addLine(
      camera,
      "flash",
      "Flash",
      lines
    );

    addLine(
      camera,
      "video",
      "Video",
      lines
    );

    addLine(
      camera,
      "video_fps",
      "FPS",
      lines
    );

    addLine(
      camera,
      "selfie",
      "Selfie",
      lines
    );

    /*
     * =================================================
     * BATTERY
     * =================================================
     */

    lines.push(`\n🔋 BATTERY`);

    addLine(
      battery,
      "capacity",
      "Capacity",
      lines
    );

    addLine(
      battery,
      "charging",
      "Charging",
      lines
    );

    addLine(
      battery,
      "usb",
      "USB",
      lines
    );

    /*
     * =================================================
     * BODY
     * =================================================
     */

    if (
      body.dimensions ||
      body.weight ||
      body.colors
    ) {
      lines.push(`\n📐 BODY`);

      addLine(
        body,
        "dimensions",
        "Dimensions",
        lines
      );

      addLine(
        body,
        "weight",
        "Weight",
        lines
      );

      addLine(
        body,
        "colors",
        "Colors",
        lines
      );
    }

    /*
     * =================================================
     * NETWORK
     * =================================================
     */

    lines.push(`\n📶 NETWORK`);

    addLine(
      network,
      "technology",
      "Technology",
      lines
    );

    addLine(
      network,
      "sim",
      "SIM",
      lines
    );

    addLine(
      network,
      "speed",
      "Speed",
      lines
    );

    addLine(
      network,
      "wifi",
      "Wi-Fi",
      lines
    );

    addLine(
      network,
      "bluetooth",
      "Bluetooth",
      lines
    );

    addLine(
      network,
      "gps",
      "GPS",
      lines
    );

    addLine(
      network,
      "nfc",
      "NFC",
      lines
    );

    /*
     * =================================================
     * SECURITY
     * =================================================
     */

    if (
      sensors.fingerprint ||
      sensors.fingerprint_position ||
      sensors.face_unlock
    ) {
      lines.push(`\n🔐 SECURITY`);

      addLine(
        sensors,
        "fingerprint",
        "Fingerprint",
        lines
      );

      addLine(
        sensors,
        "fingerprint_position",
        "Position",
        lines
      );

      addLine(
        sensors,
        "face_unlock",
        "Face Unlock",
        lines
      );
    }

    /*
     * =================================================
     * MULTIMEDIA
     * =================================================
     */

    if (
      multimedia.speaker ||
      multimedia.audio_jack ||
      multimedia.fm
    ) {
      lines.push(`\n🎵 MULTIMEDIA`);

      addLine(
        multimedia,
        "speaker",
        "Speaker",
        lines
      );

      addLine(
        multimedia,
        "audio_jack",
        "Audio Jack",
        lines
      );

      addLine(
        multimedia,
        "fm",
        "FM Radio",
        lines
      );
    }

    /*
     * =================================================
     * FOOTER
     * =================================================
     */

    lines.push(
      `\n━━━━━━━━━━━━━━━━━━`
    );

    lines.push(
      `📱 Phone Information`
    );

    const message = lines.join("\n");

    /*
     * =================================================
     * IMAGES
     * =================================================
     */

    const attachments = [];

    const tempDir = fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "phone-"
      )
    );

    const images = Array.isArray(
      phone.images
    )
      ? phone.images.slice(0, 3)
      : [];

    for (
      let i = 0;
      i < images.length;
      i++
    ) {
      try {
        const imageResponse =
          await axios.get(
            images[i],
            {
              responseType:
                "arraybuffer",
              timeout: 30000
            }
          );

        const filePath =
          path.join(
            tempDir,
            `phone-${i + 1}.jpg`
          );

        fs.writeFileSync(
          filePath,
          imageResponse.data
        );

        attachments.push(
          fs.createReadStream(
            filePath
          )
        );
      } catch (error) {
        console.log(
          `Phone image ${i + 1} failed:`,
          error.message
        );
      }
    }

    /*
     * =================================================
     * SEND
     * =================================================
     */

    if (attachments.length) {
      await api.sendMessage(
        {
          body: message,
          attachment: attachments
        },
        event.threadID,
        event.messageID
      );
    } else {
      await api.sendMessage(
        message,
        event.threadID,
        event.messageID
      );
    }

    /*
     * =================================================
     * CLEANUP
     * =================================================
     */

    setTimeout(() => {
      try {
        fs.rmSync(
          tempDir,
          {
            recursive: true,
            force: true
          }
        );
      } catch {}
    }, 10000);

  } catch (error) {
    console.error(
      "PHONE DETAILS ERROR:",
      error
    );

    if (loading?.messageID) {
      try {
        await api.unsendMessage(
          loading.messageID
        );
      } catch {}
    }

    return api.sendMessage(
      `❌ | Failed to get phone information.\n\n` +
        `📱 Model: ${model || phone?.name || "Unknown"}\n` +
        `⚠️ ${error.message}`,
      event.threadID,
      event.messageID
    );
  }
}