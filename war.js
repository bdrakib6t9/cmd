const TIMEOUT_SECONDS = 120;

const ongoingFights = new Map();
const gameInstances = new Map();
const pendingChallenges = new Map();

const MAX_ENERGY = 100;

/* =========================================================
 * HP / ENERGY BAR
 * ========================================================= */

function bar(current, max, length = 10, filledChar = "█", emptyChar = "░") {
  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * length);
  return filledChar.repeat(filled) + emptyChar.repeat(length - filled);
}

function hpBar(current, max, length = 10) {
  const ratio = Math.max(0, Math.min(1, current / max));
  return `[${bar(current, max, length)}] ${Math.round(ratio * 100)}%`;
}

function energyBar(current, max = MAX_ENERGY) {
  return `[${bar(current, max, 10, "⚡", "·")}] ${Math.max(0, Math.round(current))}/${max}`;
}

function hpLine(p) {
  const hp = Math.max(0, p.hp);
  const maxHP = p.maxHP;
  const icon =
    hp > maxHP * 0.5 ? "💚" :
    hp > maxHP * 0.25 ? "💛" :
    hp > 0 ? "❤️" : "💀";

  return `${icon} ${p.name}: ${hp}/${maxHP} HP ${hpBar(hp, maxHP)}`;
}

function energyLine(p) {
  return `⚡ ${p.name}: ${energyBar(p.energy)}`;
}

/* =========================================================
 * MOVES
 * ========================================================= */

const MOVES = {
  punch: {
    min: 5, max: 15, cost: 5,
    emoji: "👊", type: "basic", label: "punch"
  },

  kick: {
    min: 10, max: 20, cost: 8,
    emoji: "🦵", type: "basic", label: "kick"
  },

  slap: {
    min: 1, max: 5, cost: 2,
    emoji: "✋", type: "basic", label: "slap"
  },

  headbutt: {
    min: 15, max: 25, cost: 10,
    emoji: "🗿", type: "basic", label: "headbutt"
  },

  elbow: {
    min: 8, max: 18, cost: 7,
    emoji: "💪", type: "basic", label: "elbow"
  },

  uppercut: {
    min: 12, max: 22, cost: 10,
    emoji: "🥊", type: "basic", label: "uppercut"
  },

  backslash: {
    min: 20, max: 35, cost: 15,
    emoji: "⚡", type: "power", label: "backslash"
  },

  dropkick: {
    min: 18, max: 30, cost: 14,
    emoji: "🌀", type: "power", label: "dropkick"
  },

  suplex: {
    min: 22, max: 38, cost: 18,
    emoji: "🤼", type: "power", label: "suplex"
  },

  haymaker: {
    min: 25, max: 40, cost: 20,
    emoji: "💢", type: "power", label: "haymaker"
  },

  stomp: {
    min: 14, max: 28, cost: 12,
    emoji: "👟", type: "power", label: "stomp"
  },

  deathblow: {
    min: 35, max: 55, cost: 30,
    emoji: "💀",
    type: "special",
    label: "deathblow",
    requires: "deathblow"
  },

  sonicfist: {
    min: 30, max: 50, cost: 27,
    emoji: "🌪️",
    type: "special",
    label: "sonicfist",
    requires: "sonicfist"
  },

  shockwave: {
    min: 28, max: 45, cost: 25,
    emoji: "⚡",
    type: "special",
    label: "shockwave",
    requires: "shockwave",
    status: "shock"
  },

  blazekick: {
    min: 32, max: 52, cost: 30,
    emoji: "🔥",
    type: "special",
    label: "blazekick",
    requires: "blazekick",
    status: "burn"
  },

  block: {
    type: "defense",
    cost: 5,
    emoji: "🛡️",
    label: "block"
  },

  parry: {
    type: "defense",
    cost: 8,
    emoji: "⚔️",
    label: "parry"
  },

  counter: {
    type: "defense",
    cost: 10,
    emoji: "🔄",
    label: "counter"
  },

  evade: {
    type: "defense",
    cost: 8,
    emoji: "💨",
    label: "evade"
  }
};

/* =========================================================
 * TRAITS
 * ========================================================= */

const TRAITS = {
  ironhide: {
    label: "𝗜𝗿𝗼𝗻 𝗛𝗶𝗱𝗲",
    desc: "Reduces incoming damage by 18%.",
    defBonus: 18
  },

  shadowstep: {
    label: "𝗦𝗵𝗮𝗱𝗼𝘄 𝗦𝘁𝗲𝗽",
    desc: "+20% dodge chance.",
    agilityBonus: 20
  },

  berserker: {
    label: "𝗕𝗲𝗿𝘀𝗲𝗿𝗸𝗲𝗿",
    desc: "+12 damage to every attack.",
    atkBonus: 12
  },

  cursed: {
    label: "𝗖𝘂𝗿𝘀𝗲𝗱 𝗙𝗶𝘀𝘁",
    desc: "Attacks reduce opponent defense.",
    debuff: 10
  },

  phoenix: {
    label: "𝗣𝗵𝗼𝗲𝗻𝗶𝘅 𝗕𝗹𝗼𝗼𝗱",
    desc: "Survive one lethal attack with 1 HP.",
    revive: true
  }
};

/* =========================================================
 * STATS
 * ========================================================= */

function getStats(userData) {
  const d = userData.data || {};

  return {
    level: d.fightLevel || 1,
    wins: d.fightWins || 0,
    losses: d.fightLosses || 0,

    atkBonus: d.fightAtkBonus || 0,
    defBonus: d.fightDefBonus || 0,
    agilityBonus: d.fightAgilityBonus || 0,
    bonusHP: d.fightBonusHP || 0,

    abilities: d.fightAbilities || {},
    trait: d.fightTrait || null,
    skills: d.fightSkills || {},

    trainedAt: d.fightTrainedAt || 0,
    xp: d.fightXP || 0,

    streak: d.fightStreak || 0,
    bestStreak: d.fightBestStreak || 0,

    achievements: d.fightAchievements || []
  };
}

function xpForLevel(level) {
  return level * 100;
}

function calcLevel(stats) {
  let level = 1;
  let xp = stats.xp || 0;

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;

    if (level >= 100)
      break;
  }

  return level;
}

/* =========================================================
 * RANK
 * ========================================================= */

function getRank(level) {
  if (level >= 75)
    return { name: "Legend", icon: "💀" };

  if (level >= 50)
    return { name: "Grandmaster", icon: "👑" };

  if (level >= 35)
    return { name: "Master", icon: "🔥" };

  if (level >= 20)
    return { name: "Elite", icon: "⚔️" };

  if (level >= 10)
    return { name: "Warrior", icon: "🥇" };

  if (level >= 5)
    return { name: "Fighter", icon: "🥈" };

  return { name: "Rookie", icon: "🥉" };
}

/* =========================================================
 * ACHIEVEMENTS
 * ========================================================= */

const ACHIEVEMENTS = {
  firstblood: {
    label: "🩸 First Blood",
    desc: "Win your first fight."
  },

  knockout: {
    label: "💀 Knockout",
    desc: "Win by reducing opponent to 0 HP."
  },

  survivor: {
    label: "❤️ Survivor",
    desc: "Win with 10 HP or less."
  },

  untouchable: {
    label: "💨 Untouchable",
    desc: "Win without taking damage."
  },

  berserker: {
    label: "🔥 Berserker",
    desc: "Deal 100+ damage in one attack."
  },

  champion: {
    label: "👑 Champion",
    desc: "Reach 50 wins."
  },

  streak10: {
    label: "🔥 Win Streak",
    desc: "Reach a 10-win streak."
  }
};

async function awardAchievements(usersData, userID, data, fight, winner) {
  const stats = getStats(data);
  const achievements = new Set(stats.achievements || []);

  const wins = stats.wins + 1;
  const winnerParticipant = winner;

  if (wins >= 1)
    achievements.add("firstblood");

  if (winnerParticipant.hp <= 10)
    achievements.add("survivor");

  if (fight.maxDamageTaken?.[userID] === 0)
    achievements.add("untouchable");

  if (fight.maxSingleDamage >= 100 && fight.maxDamageUser === userID)
    achievements.add("berserker");

  if (wins >= 50)
    achievements.add("champion");

  if ((stats.streak || 0) >= 10)
    achievements.add("streak10");

  await usersData.set(userID, {
    data: {
      ...data.data,
      fightAchievements: [...achievements]
    }
  });

  return [...achievements];
}

/* =========================================================
 * STATUS EFFECTS
 * ========================================================= */

function addStatus(target, type, turns, damage) {
  target.statuses = target.statuses || {};

  target.statuses[type] = {
    turns,
    damage
  };
}

function processStatuses(player) {
  if (!player.statuses)
    return {
      damage: 0,
      text: ""
    };

  let damage = 0;
  let text = "";

  for (const [type, status] of Object.entries(player.statuses)) {
    if (status.turns <= 0)
      continue;

    damage += status.damage;

    const icon =
      type === "burn" ? "🔥" :
      type === "bleed" ? "🩸" :
      type === "shock" ? "⚡" :
      "☠️";

    text += `${icon} ${player.name} suffers ${status.damage} ${type} damage!\n`;

    status.turns--;

    if (status.turns <= 0)
      delete player.statuses[type];
  }

  return {
    damage,
    text
  };
}

/* =========================================================
 * MODULE
 * ========================================================= */

module.exports = {

  config: {
    name: "war",
    aliases: ["duel", "fight"],
    version: "4.0",
    author: "Rakib",
    countDown: 10,
    role: 0,

    shortDescription: {
      en: "⚔️ Fight, bet & rise through the ranks!"
    },

    category: "fun",

    guide: {
      en:
        "{pn} @mention | reply | UID\n" +
        "{pn} topfighter — 🏆 Leaderboard\n" +
        "{pn} profile — ⚔️ Fighter profile\n" +
        "{pn} achievements — 🎖️ Achievements\n\n" +

        "Basic:\n" +
        "punch, kick, slap, headbutt, elbow, uppercut\n\n" +

        "Power:\n" +
        "backslash, dropkick, suplex, haymaker, stomp\n\n" +

        "Special:\n" +
        "deathblow, sonicfist, shockwave, blazekick\n\n" +

        "Defense:\n" +
        "block, parry, counter, evade\n\n" +

        "Ability:\n" +
        "heal\n\n" +

        "⚠️ During a fight, ALL actions must be sent as a reply."
    }
  },

  /* =======================================================
   * ON START
   * ======================================================= */

  onStart: async function ({
    event,
    message,
    usersData,
    args
  }) {

    const threadID = event.threadID;
    const senderID = event.senderID;

    /* =====================================================
     * PROFILE
     * ===================================================== */

    if (
      args[0] === "profile" ||
      args[0] === "me"
    ) {

      const data = await usersData.get(senderID);
      const stats = getStats(data);
      const rank = getRank(stats.level);

      const total =
        stats.wins +
        stats.losses;

      const wr = total
        ? ((stats.wins / total) * 100).toFixed(1)
        : "0.0";

      return message.reply(
        `⚔️ 𝗙𝗜𝗚𝗛𝗧𝗘𝗥 𝗣𝗥𝗢𝗙𝗜𝗟𝗘\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 ${data.name || "Unknown"}\n` +
        `${rank.icon} Rank: ${rank.name}\n` +
        `⭐ Level: ${stats.level}\n\n` +

        `🏆 Wins: ${stats.wins}\n` +
        `💀 Losses: ${stats.losses}\n` +
        `📊 Win Rate: ${wr}%\n` +
        `🔥 Current Streak: ${stats.streak}\n` +
        `👑 Best Streak: ${stats.bestStreak}\n\n` +

        `⚔️ ATK: +${stats.atkBonus}\n` +
        `🛡️ DEF: +${stats.defBonus}\n` +
        `💨 AGI: +${stats.agilityBonus}\n` +
        `❤️ Bonus HP: +${stats.bonusHP}\n\n` +

        `🧬 Trait: ${TRAITS[stats.trait]?.label || "None"}\n` +
        `🎖️ Achievements: ${stats.achievements.length}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`
      );
    }

    /* =====================================================
     * ACHIEVEMENTS
     * ===================================================== */

    if (
      args[0] === "achievements" ||
      args[0] === "achievement"
    ) {

      const data = await usersData.get(senderID);
      const stats = getStats(data);

      let text =
        `🎖️ 𝗙𝗜𝗚𝗛𝗧 𝗔𝗖𝗛𝗜𝗘𝗩𝗘𝗠𝗘𝗡𝗧𝗦\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n`;

      for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {

        const unlocked =
          stats.achievements.includes(id);

        text +=
          `${unlocked ? "✅" : "🔒"} ${ach.label}\n` +
          `   ${ach.desc}\n\n`;
      }

      text += `━━━━━━━━━━━━━━━━━━━━━━`;

      return message.reply(text);
    }

    /* =====================================================
     * LEADERBOARD
     * ===================================================== */

    if (
      args[0] === "topfighter" ||
      args[0] === "topfight" ||
      args[0] === "top"
    ) {

      const allUsers = await usersData.getAll();

      const fighters = allUsers
        .filter(u =>
          u.data &&
          (u.data.fightWins || 0) > 0
        )
        .sort((a, b) => {

          const aw = a.data.fightWins || 0;
          const bw = b.data.fightWins || 0;

          if (bw !== aw)
            return bw - aw;

          return (
            (a.data.fightLosses || 0) -
            (b.data.fightLosses || 0)
          );
        });

      if (!fighters.length) {
        return message.reply(
          `🥊 𝗧𝗢𝗣 𝗙𝗜𝗚𝗛𝗧𝗘𝗥𝗦\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `No fighters yet!`
        );
      }

      const medals = [
        "🥇",
        "🥈",
        "🥉"
      ];

      let msg =
        `🥊 𝗧𝗢𝗣 𝗙𝗜𝗚𝗛𝗧𝗘𝗥𝗦\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n`;

      fighters
        .slice(0, 10)
        .forEach((u, i) => {

          const wins =
            u.data.fightWins || 0;

          const losses =
            u.data.fightLosses || 0;

          const total =
            wins + losses;

          const wr = total
            ? ((wins / total) * 100).toFixed(1)
            : "0.0";

          const level =
            u.data.fightLevel || 1;

          const rank =
            getRank(level);

          msg +=
            `${medals[i] || `${i + 1}.`} ` +
            `${rank.icon} Lv.${level} ` +
            `${u.name}\n`;

          msg +=
            `   🏆 ${wins}W  ` +
            `💀 ${losses}L  ` +
            `📊 ${wr}%\n\n`;
        });

      return message.reply(msg);
    }

    /* =====================================================
     * EXISTING FIGHT CHECK
     * ===================================================== */

    if (ongoingFights.has(threadID)) {
      return message.send(
        `⚔️ A fight is already in progress here.`
      );
    }

    /* =====================================================
     * RESOLVE OPPONENT
     * ===================================================== */

    let opponentID;

    if (
      event.type === "message_reply" &&
      event.messageReply?.senderID
    ) {

      opponentID =
        event.messageReply.senderID;

    } else if (
      event.mentions &&
      Object.keys(event.mentions).length
    ) {

      opponentID =
        Object.keys(event.mentions)[0];

    } else if (
      args[0] &&
      /^\d+$/.test(args[0])
    ) {

      opponentID = args[0];
    }

    if (!opponentID) {

      return message.send(
        `🤔 𝗛𝗢𝗪 𝗧𝗢 𝗖𝗛𝗔𝗟𝗟𝗘𝗡𝗚𝗘\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚔️ Mention someone\n` +
        `⚔️ Reply to someone's message\n` +
        `⚔️ Or provide their UID\n\n` +
        `Example:\n` +
        `war @user\n` +
        `war 123456789`
      );
    }

    if (opponentID === senderID) {
      return message.send(
        `🤡 You cannot fight yourself.`
      );
    }

    try {

      const challengerID =
        senderID;

      const challengerName =
        await usersData.getName(
          challengerID
        );

      const opponentName =
        await usersData.getName(
          opponentID
        );

      const key =
        `${threadID}_${challengerID}`;

      pendingChallenges.set(key, {

        challengerID,
        challengerName,

        opponentID,
        opponentName,

        threadID,

        step: "mode_selection"

      });

      await message.send(
        `🤺 𝗙𝗜𝗚𝗛𝗧 𝗖𝗛𝗔𝗟𝗟𝗘𝗡𝗚𝗘!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 ${challengerName} challenges ${opponentName}!\n\n` +

        `Choose mode:\n` +
        `💰 Type "bet" — Money match\n` +
        `🤝 Type "friendly" — Friendly match\n\n` +

        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⏱️ Reply within 60s or type "cancel"`
      );

      setTimeout(() => {

        if (pendingChallenges.has(key)) {

          pendingChallenges.delete(key);

          message.send(
            `⏰ Challenge expired — no response.`
          );
        }

      }, 60_000);

    } catch {

      return message.send(
        `❌ Could not find that user.`
      );
    }
  },

  /* =======================================================
   * ON CHAT
   * ======================================================= */

  onChat: async function ({
    event,
    message,
    usersData
  }) {

    const threadID =
      event.threadID;

    const senderID =
      event.senderID;

    const input =
      (event.body || "")
        .trim()
        .toLowerCase();

    /* =====================================================
     * PENDING CHALLENGE
     * ===================================================== */

    const cKey =
      `${threadID}_${senderID}`;

    const pending =
      pendingChallenges.get(cKey);

    if (pending) {

      const {
        challengerID,
        challengerName,
        opponentID,
        opponentName,
        step
      } = pending;

      if (input === "cancel") {

        pendingChallenges.delete(cKey);

        return message.send(
          `❌ Challenge cancelled.`
        );
      }

      if (step === "mode_selection") {

        if (input === "bet") {

          pending.mode = "bet";
          pending.step = "bet_amount";

          return message.send(
            `💰 𝗕𝗘𝗧 𝗠𝗢𝗗𝗘\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${challengerName}, how much will you wager?\n` +
            `(Minimum $1,000)`
          );
        }

        if (input === "friendly") {

          pendingChallenges.delete(cKey);

          return this.startFight(
            message,
            usersData,
            {
              challengerID,
              challengerName,
              opponentID,
              opponentName,
              threadID,
              mode: "friendly",
              challengerBet: 0,
              opponentBet: 0
            }
          );
        }

        return;
      }

      if (step === "bet_amount") {

        const bet =
          parseInt(
            input.replace(/[,$\s]/g, "")
          );

        if (
          isNaN(bet) ||
          bet < 1000
        ) {

          return message.send(
            `❌ Invalid amount.\n` +
            `Minimum: $1,000`
          );
        }

        const cData =
          await usersData.get(
            challengerID
          );

        if (
          (cData.money || 0) < bet
        ) {

          return message.send(
            `❌ Insufficient funds!\n` +
            `💵 Balance: $${(cData.money || 0).toLocaleString()}`
          );
        }

        pending.challengerBet = bet;
        pending.step = "waiting_opponent_bet";

        const oKey =
          `${threadID}_${opponentID}`;

        pendingChallenges.set(
          oKey,
          {
            ...pending,
            step: "opponent_bet"
          }
        );

        pendingChallenges.delete(cKey);

        return message.send(
          `💰 ${challengerName} bets $${bet.toLocaleString()}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${opponentName}, how much will you wager?\n` +
          `(Type amount or "decline")`
        );
      }
    }

    /* =====================================================
     * OPPONENT BET
     * ===================================================== */

    const oKey =
      `${threadID}_${senderID}`;

    const oppChal =
      pendingChallenges.get(oKey);

    if (
      oppChal?.step === "opponent_bet"
    ) {

      if (input === "decline") {

        pendingChallenges.delete(oKey);

        return message.send(
          `❌ ${oppChal.opponentName} declined the fight.`
        );
      }

      const bet =
        parseInt(
          input.replace(/[,$\s]/g, "")
        );

      if (
        isNaN(bet) ||
        bet < 1000
      ) {

        return message.send(
          `❌ Invalid amount.\nMinimum: $1,000`
        );
      }

      const oData =
        await usersData.get(senderID);

      if (
        (oData.money || 0) < bet
      ) {

        return message.send(
          `❌ Insufficient funds!\n` +
          `💵 Balance: $${(oData.money || 0).toLocaleString()}`
        );
      }

      oppChal.opponentBet = bet;

      pendingChallenges.delete(oKey);

      return this.startFight(
        message,
        usersData,
        oppChal
      );
    }

    /* =====================================================
     * ACTIVE FIGHT
     * ===================================================== */

    const inst =
      gameInstances.get(threadID);

    if (!inst)
      return;

    const { fight } = inst;

    const isP1 =
      senderID ===
      fight.participants[0].id;

    const isP2 =
      senderID ===
      fight.participants[1].id;

    if (!isP1 && !isP2)
      return;

    /* =====================================================
     * REPLY REQUIRED
     * ===================================================== */

    if (
      event.type !== "message_reply" ||
      !event.messageReply?.senderID
    ) {

      return message.send(
        `⚔️ 𝗥𝗘𝗣𝗟𝗬 𝗥𝗘𝗤𝗨𝗜𝗥𝗘𝗗!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Fight চলাকালীন action দিতে হলে\n` +
        `কোনো message-এ reply করতে হবে.\n\n` +
        `Example:\n` +
        `↳ Reply\n` +
        `punch\n\n` +
        `💡 Available:\n` +
        `👊 punch | 🦵 kick | 💢 haymaker\n` +
        `🛡️ block | ⚔️ parry | 💨 evade\n` +
        `💚 heal | 🏳️ forfeit`
      );
    }

    /* =====================================================
     * TURN CHECK
     * ===================================================== */

    if (
      senderID !==
      fight.currentPlayer
    ) {

      if (!inst.turnMessageSent) {

        const cur =
          fight.participants.find(
            p =>
              p.id ===
              fight.currentPlayer
          );

        await message.send(
          `⏳ Wait!\n` +
          `It's ${cur?.name || "opponent"}'s turn.`
        );

        inst.turnMessageSent = true;
      }

      return;
    }

    /* =====================================================
     * FORFEIT
     * ===================================================== */

    if (input === "forfeit") {

      const loser =
        fight.participants.find(
          p => p.id === senderID
        );

      const winner =
        fight.participants.find(
          p => p.id !== senderID
        );

      await this.handleFightEnd(
        message,
        usersData,
        fight,
        winner,
        loser,
        true
      );

      return endFight(threadID);
    }

    /* =====================================================
     * CURRENT PLAYER
     * ===================================================== */

    const attacker =
      fight.participants.find(
        p => p.id === senderID
      );

    const defender =
      fight.participants.find(
        p => p.id !== senderID
      );

    /* =====================================================
     * TURN STATUS DAMAGE
     * ===================================================== */

    const status =
      processStatuses(attacker);

    if (status.damage > 0) {

      attacker.hp -= status.damage;

      await message.send(
        `☠️ 𝗦𝗧𝗔𝗧𝗨𝗦 𝗘𝗙𝗙𝗘𝗖𝗧\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        status.text +
        `\n${hpLine(attacker)}`
      );

      if (attacker.hp <= 0) {

        await this.handleFightEnd(
          message,
          usersData,
          fight,
          defender,
          attacker,
          false
        );

        return endFight(threadID);
      }
    }

    /* =====================================================
     * HEAL
     * ===================================================== */

    if (input === "heal") {

      const healerData =
        await usersData.get(
          senderID
        );

      const healerStats =
        getStats(healerData);

      if (!healerStats.abilities?.heal) {

        return message.send(
          `🔒 𝗛𝗘𝗔𝗟 𝗟𝗢𝗖𝗞𝗘𝗗!\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Purchase using:\n` +
          `+fightupgrade buy heal`
        );
      }

      fight.healUsed =
        fight.healUsed || {};

      if (
        fight.healUsed[senderID]
      ) {

        return message.send(
          `❌ You've already used heal this fight!\n\n` +
          hpLine(attacker)
        );
      }

      if (attacker.energy < 15) {

        return message.send(
          `⚡ Not enough energy!\n` +
          `Heal requires 15 energy.`
        );
      }

      attacker.energy -= 15;

      fight.healUsed[senderID] = true;

      const healAmount =
        Math.floor(
          attacker.maxHP * 0.5
        );

      const oldHP =
        attacker.hp;

      attacker.hp =
        Math.min(
          attacker.maxHP,
          attacker.hp + healAmount
        );

      const restored =
        attacker.hp - oldHP;

      await message.send(
        `💚 𝗛𝗘𝗔𝗟!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ ${attacker.name} recovered ${restored} HP!\n\n` +
        `${hpLine(attacker)}\n` +
        `${hpLine(defender)}\n\n` +
        `${energyLine(attacker)}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ Heal can only be used once per fight!`
      );

      fight.currentPlayer =
        defender.id;

      inst.turnMessageSent = false;

      resetTimeout(
        threadID,
        message
      );

      return;
    }

    const atkData =
      await usersData.get(
        attacker.id
      );

    const defData =
      await usersData.get(
        defender.id
      );

    const atkStats =
      getStats(atkData);

    const defStats =
      getStats(defData);

    const move =
      MOVES[input];

    /* =====================================================
     * INVALID ACTION
     * ===================================================== */

    if (
      !move ||
      ![
        "basic",
        "power",
        "special",
        "defense"
      ].includes(move.type)
    ) {

      return message.send(
        `❌ Unknown fight action: ${input}\n\n` +
        `👊 punch | 🦵 kick | ✋ slap\n` +
        `🗿 headbutt | 💪 elbow | 🥊 uppercut\n` +
        `⚡ backslash | 🌀 dropkick | 🤼 suplex\n` +
        `💢 haymaker | 👟 stomp\n` +
        `🛡️ block | ⚔️ parry | 🔄 counter | 💨 evade`
      );
    }

    /* =====================================================
     * ENERGY CHECK
     * ===================================================== */

    const cost =
      move.cost || 0;

    if (
      attacker.energy < cost
    ) {

      return message.send(
        `⚡ 𝗡𝗢𝗧 𝗘𝗡𝗢𝗨𝗚𝗛 𝗘𝗡𝗘𝗥𝗚𝗬!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${attacker.name}: ${attacker.energy}/100\n` +
        `Required: ${cost}\n\n` +
        `💡 Energy regenerates after every turn.`
      );
    }

    attacker.energy -= cost;

    /* =====================================================
     * SPECIAL LOCK
     * ===================================================== */

    if (
      move.requires &&
      !(atkStats.skills?.[move.requires] >= 1)
    ) {

      attacker.energy += cost;

      return message.send(
        `🔒 "${input}" is locked!\n` +
        `Use +fightupgrade to unlock it.`
      );
    }

    /* =====================================================
     * DEFENSE
     * ===================================================== */

    if (
      move.type === "defense"
    ) {

      let defMsg = "";

      if (input === "block") {

        fight.blockActive = {
          id: attacker.id,
          reduction:
            Math.min(
              0.8,
              0.45 +
              atkStats.defBonus / 200
            )
        };

        defMsg =
          `🛡️ 𝗕𝗟𝗢𝗖𝗞!\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${attacker.name} raises their guard!\n` +
          `🛡️ Next hit reduced.`;
      }

      else if (input === "parry") {

        fight.parryActive = {
          id: attacker.id
        };

        defMsg =
          `⚔️ 𝗣𝗔𝗥𝗥𝗬!\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${attacker.name} is ready to reflect damage!`;
      }

      else if (input === "counter") {

        fight.counterActive = {
          id: attacker.id
        };

        defMsg =
          `🔄 𝗖𝗢𝗨𝗡𝗧𝗘𝗥!\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${attacker.name} enters counter stance!`;
      }

      else if (input === "evade") {

        const chance =
          Math.min(
            0.85,
            0.55 +
            atkStats.agilityBonus / 200
          );

        fight.evadeActive = {
          id: attacker.id,
          chance
        };

        defMsg =
          `💨 𝗘𝗩𝗔𝗗𝗘!\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${attacker.name} prepares to dodge!\n` +
          `💨 ${Math.round(chance * 100)}% dodge chance`;
      }

      await message.send(
        defMsg +
        `\n━━━━━━━━━━━━━━━━━━━━━━\n` +
        hpLine(attacker) +
        `\n` +
        hpLine(defender) +
        `\n` +
        energyLine(attacker)
      );

      attacker.energy =
        Math.min(
          MAX_ENERGY,
          attacker.energy + 12
        );

      fight.currentPlayer =
        defender.id;

      inst.turnMessageSent = false;

      resetTimeout(
        threadID,
        message
      );

      return;
    }

    /* =====================================================
     * COUNTER
     * ===================================================== */

    if (
      fight.counterActive?.id ===
      defender.id
    ) {

      delete fight.counterActive;

      const reflected =
        Math.max(
          10,
          Math.floor(
            10 +
            atkStats.atkBonus
          )
        );

      attacker.hp -= reflected;

      fight.maxDamageTaken[attacker.id] =
        (fight.maxDamageTaken[attacker.id] || 0) +
        reflected;

      await message.send(
        `🔄 𝗖𝗢𝗨𝗡𝗧𝗘𝗥𝗘𝗗!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${defender.name} countered the attack!\n\n` +
        `💥 ${attacker.name} takes ${reflected} reflected damage!\n\n` +
        hpLine(attacker) +
        `\n` +
        hpLine(defender)
      );

      if (
        attacker.hp <= 0
      ) {

        await this.handleFightEnd(
          message,
          usersData,
          fight,
          defender,
          attacker,
          false
        );

        return endFight(threadID);
      }

      attacker.energy =
        Math.min(
          MAX_ENERGY,
          attacker.energy + 12
        );

      fight.currentPlayer =
        defender.id;

      inst.turnMessageSent = false;

      return resetTimeout(
        threadID,
        message
      );
    }

    /* =====================================================
     * DAMAGE
     * ===================================================== */

    let damage =
      Math.floor(
        Math.random() *
        (move.max - move.min + 1)
      ) +
      move.min;

    damage +=
      atkStats.atkBonus;

    if (
      atkStats.skills?.[input]
    ) {

      damage +=
        atkStats.skills[input] * 3;
    }

    const atkTrait =
      TRAITS[atkStats.trait];

    const defTrait =
      TRAITS[defStats.trait];

    if (
      atkTrait?.atkBonus
    ) {

      damage +=
        atkTrait.atkBonus;
    }

    /* =====================================================
     * BERSERKER LOW HP BONUS
     * ===================================================== */

    if (
      atkStats.trait === "berserker" &&
      attacker.hp <=
      attacker.maxHP * 0.3
    ) {

      damage += 15;
    }

    /* =====================================================
     * DODGE
     * ===================================================== */

    let dodgeChance =
      0.08 +
      defStats.agilityBonus / 200;

    if (
      defTrait?.agilityBonus
    ) {

      dodgeChance +=
        defTrait.agilityBonus / 100;
    }

    if (
      fight.evadeActive?.id ===
      defender.id
    ) {

      dodgeChance =
        fight.evadeActive.chance;

      delete fight.evadeActive;
    }

    const isDodge =
      Math.random() <
      dodgeChance;

    if (isDodge) {

      await message.send(
        `💨 𝗗𝗢𝗗𝗚𝗘𝗗!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${move.emoji} ${attacker.name} used ${move.label}\n` +
        `🌪️ ${defender.name} evaded the attack!\n\n` +
        hpLine(attacker) +
        `\n` +
        hpLine(defender)
      );

      attacker.energy =
        Math.min(
          MAX_ENERGY,
          attacker.energy + 12
        );

      fight.combo[attacker.id] = 0;

      fight.currentPlayer =
        defender.id;

      inst.turnMessageSent = false;

      return resetTimeout(
        threadID,
        message
      );
    }

    /* =====================================================
     * CRITICAL
     * ===================================================== */

    const isCrit =
      Math.random() < 0.15;

    if (isCrit) {

      damage =
        Math.floor(
          damage * 1.5
        );
    }

    /* =====================================================
     * COMBO
     * ===================================================== */

    fight.combo =
      fight.combo || {};

    fight.combo[attacker.id] =
      (fight.combo[attacker.id] || 0) + 1;

    const combo =
      fight.combo[attacker.id];

    if (combo >= 2) {

      const comboBonus =
        Math.min(
          20,
          (combo - 1) * 5
        );

      damage +=
        comboBonus;
    }

    /* =====================================================
     * DEFENSE REDUCTION
     * ===================================================== */

    let dmgReduction =
      defStats.defBonus / 100;

    if (
      defTrait?.defBonus
    ) {

      dmgReduction +=
        defTrait.defBonus / 100;
    }

    if (
      fight.debuffOnDefender
    ) {

      dmgReduction =
        Math.max(
          0,
          dmgReduction -
          fight.debuffOnDefender / 100
        );
    }

    /* =====================================================
     * PARRY
     * ===================================================== */

    let statusLine = "";

    if (
      fight.parryActive?.id ===
      defender.id
    ) {

      const reflected =
        Math.floor(
          damage * 0.3
        );

      attacker.hp -=
        reflected;

      damage =
        Math.floor(
          damage * 0.7
        );

      delete fight.parryActive;

      fight.maxDamageTaken[attacker.id] =
        (fight.maxDamageTaken[attacker.id] || 0) +
        reflected;

      statusLine +=
        `⚔️ 𝗣𝗔𝗥𝗥𝗜𝗘𝗗! ` +
        `${defender.name} reflected ${reflected} damage!\n`;
    }

    /* =====================================================
     * BLOCK
     * ===================================================== */

    if (
      fight.blockActive?.id ===
      defender.id
    ) {

      damage =
        Math.floor(
          damage *
          (
            1 -
            fight.blockActive.reduction
          )
        );

      delete fight.blockActive;

      statusLine +=
        `🛡️ 𝗕𝗟𝗢𝗖𝗞𝗘𝗗! ` +
        `Damage reduced!\n`;
    }

    /* =====================================================
     * CURSE
     * ===================================================== */

    if (
      atkTrait?.debuff
    ) {

      fight.debuffOnDefender =
        (
          fight.debuffOnDefender || 0
        ) +
        atkTrait.debuff;

      statusLine +=
        `☠️ 𝗖𝗨𝗥𝗦𝗘! ` +
        `${defender.name} −${atkTrait.debuff}% defense!\n`;
    }

    /* =====================================================
     * FINAL DAMAGE
     * ===================================================== */

    damage =
      Math.max(
        1,
        Math.floor(
          damage *
          (1 - dmgReduction)
        )
      );

    defender.hp -=
      damage;

    fight.maxSingleDamage =
      Math.max(
        fight.maxSingleDamage || 0,
        damage
      );

    fight.maxDamageUser =
      attacker.id;

    fight.maxDamageTaken[defender.id] =
      (fight.maxDamageTaken[defender.id] || 0) +
      damage;

    /* =====================================================
     * STATUS EFFECTS
     * ===================================================== */

    if (
      move.status === "burn"
    ) {

      addStatus(
        defender,
        "burn",
        2,
        8
      );

      statusLine +=
        `🔥 BURN applied! ` +
        `8 damage for 2 turns.\n`;
    }

    if (
      move.status === "shock"
    ) {

      addStatus(
        defender,
        "shock",
        2,
        6
      );

      statusLine +=
        `⚡ SHOCK applied! ` +
        `6 damage for 2 turns.\n`;
    }

    /* =====================================================
     * PHOENIX
     * ===================================================== */

    if (
      defender.hp <= 0 &&
      defTrait?.revive
    ) {

      fight.phoenixUsed =
        fight.phoenixUsed || {};

      if (
        !fight.phoenixUsed[
          defender.id
        ]
      ) {

        fight.phoenixUsed[
          defender.id
        ] = true;

        defender.hp = 1;

        statusLine +=
          `🔥 𝗣𝗛𝗢𝗘𝗡𝗜𝗫 𝗕𝗟𝗢𝗢𝗗!\n` +
          `${defender.name} survives with 1 HP!\n`;
      }
    }

    /* =====================================================
     * COMBAT MESSAGE
     * ===================================================== */

    const header =
      isCrit
        ? `💥 𝗖𝗥𝗜𝗧𝗜𝗖𝗔𝗟 𝗛𝗜𝗧!\n`
        : `⚔️ 𝗔𝗧𝗧𝗔𝗖𝗞!\n`;

    let comboLine = "";

    if (combo >= 2) {

      comboLine =
        `🔥 𝗖𝗢𝗠𝗕𝗢 ×${combo}!\n`;
    }

    const atkHP =
      attacker.hp > 0
        ? hpLine(attacker)
        : `💀 ${attacker.name}: K.O.`;

    const defHP =
      defender.hp > 0
        ? hpLine(defender)
        : `💀 ${defender.name}: K.O.`;

    const output =
      header +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      comboLine +
      statusLine +
      `${move.emoji} ${attacker.name} used ${move.label}\n` +
      `💥 ${defender.name} took ${damage} damage` +
      (isCrit ? ` ⚡ CRIT!` : "") +
      `\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      atkHP +
      `\n` +
      defHP +
      `\n` +
      energyLine(attacker);

    await message.send(output);

    /* =====================================================
     * DEFEAT
     * ===================================================== */

    if (
      defender.hp <= 0
    ) {

      await new Promise(
        resolve =>
          setTimeout(resolve, 800)
      );

      await this.handleFightEnd(
        message,
        usersData,
        fight,
        attacker,
        defender,
        false
      );

      return endFight(
        threadID
      );
    }

    /* =====================================================
     * ENERGY REGEN
     * ===================================================== */

    attacker.energy =
      Math.min(
        MAX_ENERGY,
        attacker.energy + 12
      );

    /* =====================================================
     * NEXT TURN
     * ===================================================== */

    fight.currentPlayer =
      defender.id;

    inst.turnMessageSent = false;

    await message.send(
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ 𝗡𝗘𝗫𝗧 𝗧𝗨𝗥𝗡\n` +
      `👤 ${defender.name}'s turn!\n\n` +
      `${hpLine(defender)}\n` +
      `${energyLine(defender)}\n\n` +
      `💡 Reply to a message and type your action.`
    );

    resetTimeout(
      threadID,
      message
    );
  },

  /* =======================================================
   * START FIGHT
   * ======================================================= */

  startFight: async function (
    message,
    usersData,
    fightData
  ) {

    const {
      challengerID,
      challengerName,
      opponentID,
      opponentName,
      threadID,
      mode,
      challengerBet,
      opponentBet
    } = fightData;

    const cData =
      await usersData.get(
        challengerID
      );

    const oData =
      await usersData.get(
        opponentID
      );

    const cStats =
      getStats(cData);

    const oStats =
      getStats(oData);

    const cMaxHP =
      100 +
      cStats.bonusHP;

    const oMaxHP =
      100 +
      oStats.bonusHP;

    const fight = {

      participants: [

        {
          id: challengerID,
          name: challengerName,
          hp: cMaxHP,
          maxHP: cMaxHP,
          energy: MAX_ENERGY,
          statuses: {}
        },

        {
          id: opponentID,
          name: opponentName,
          hp: oMaxHP,
          maxHP: oMaxHP,
          energy: MAX_ENERGY,
          statuses: {}
        }

      ],

      currentPlayer:
        Math.random() < 0.5
          ? challengerID
          : opponentID,

      threadID,

      mode,

      challengerBet:
        challengerBet || 0,

      opponentBet:
        opponentBet || 0,

      combo: {},

      maxDamageTaken: {
        [challengerID]: 0,
        [opponentID]: 0
      },

      maxSingleDamage: 0,
      maxDamageUser: null,

      healUsed: {},

      phoenixUsed: {},

      debuffOnDefender: 0
    };

    gameInstances.set(
      threadID,
      {
        fight,
        timeoutID: null,
        turnMessageSent: false
      }
    );

    ongoingFights.set(
      threadID,
      fight
    );

    const first =
      fight.currentPlayer ===
      challengerID
        ? challengerName
        : opponentName;

    const modeText =
      mode === "bet"

        ? `💰 𝗕𝗘𝗧 𝗠𝗔𝗧𝗖𝗛\n` +
          `   ${challengerName}: $${challengerBet.toLocaleString()}\n` +
          `   ${opponentName}: $${opponentBet.toLocaleString()}\n` +
          `   🏆 Pool: $${(
            challengerBet +
            opponentBet
          ).toLocaleString()}`

        : `🤝 𝗙𝗥𝗜𝗘𝗡𝗗𝗟𝗬 𝗠𝗔𝗧𝗖𝗛\n` +
          `   🏆 Prize: $50,000,000`;

    await message.send(

      `🤺 𝗧𝗛𝗘 𝗗𝗨𝗘𝗟 𝗕𝗘𝗚𝗜𝗡𝗦!\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +

      modeText +

      `\n━━━━━━━━━━━━━━━━━━━━━━\n` +

      `👤 ${challengerName} (${cMaxHP}HP)\n` +
      `⚔️ VS\n` +
      `👤 ${opponentName} (${oMaxHP}HP)\n\n` +

      `⚡ First Turn: ${first}\n\n` +

      `👊 Basic:\n` +
      `punch, kick, slap, headbutt, elbow, uppercut\n\n` +

      `💥 Power:\n` +
      `backslash, dropkick, suplex, haymaker, stomp\n\n` +

      `🔒 Special:\n` +
      `deathblow, sonicfist, shockwave, blazekick\n\n` +

      `🛡️ Defense:\n` +
      `block, parry, counter, evade\n\n` +

      `💚 Ability: heal\n` +

      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ ALL actions must be sent as a REPLY.\n` +
      `⏱️ ${TIMEOUT_SECONDS}s turn timer`
    );

    if (
      mode === "bet"
    ) {

      await usersData.set(
        challengerID,
        {
          money:
            cData.money -
            challengerBet
        }
      );

      await usersData.set(
        opponentID,
        {
          money:
            oData.money -
            opponentBet
        }
      );
    }

    startTimeout(
      threadID,
      message
    );

    for (
      const [k, v]
      of pendingChallenges.entries()
    ) {

      if (
        v.threadID === threadID &&
        (
          v.challengerID === challengerID ||
          v.opponentID === opponentID
        )
      ) {

        pendingChallenges.delete(k);
      }
    }
  },

  /* =======================================================
   * FIGHT END
   * ======================================================= */

  handleFightEnd: async function (
    message,
    usersData,
    fight,
    winner,
    loser,
    forfeited
  ) {

    const winnerData =
      await usersData.get(
        winner.id
      );

    const loserData =
      await usersData.get(
        loser.id
      );

    const wStats =
      getStats(winnerData);

    const lStats =
      getStats(loserData);

    const xpGain =
      forfeited
        ? 20
        : 50;

    const newXP =
      (wStats.xp || 0) +
      xpGain;

    const newLevel =
      calcLevel({
        ...wStats,
        xp: newXP
      });

    const newWins =
      (wStats.wins || 0) +
      1;

    const newLosses =
      (lStats.losses || 0) +
      1;

    const newStreak =
      (wStats.streak || 0) +
      1;

    const bestStreak =
      Math.max(
        wStats.bestStreak || 0,
        newStreak
      );

    const winnings =
      fight.mode === "bet"

        ? fight.challengerBet +
          fight.opponentBet

        : 50_000_000;

    const winnerRank =
      getRank(newLevel);

    /* =====================================================
     * WINNER
     * ===================================================== */

    await usersData.set(
      winner.id,
      {
        money:
          (winnerData.money || 0) +
          winnings,

        data: {
          ...winnerData.data,

          fightWins:
            newWins,

          fightXP:
            newXP,

          fightLevel:
            newLevel,

          fightStreak:
            newStreak,

          fightBestStreak:
            bestStreak
        }
      }
    );

    /* =====================================================
     * LOSER
     * ===================================================== */

    await usersData.set(
      loser.id,
      {
        data: {
          ...loserData.data,

          fightLosses:
            newLosses,

          fightStreak:
            0
        }
      }
    );

    /* =====================================================
     * ACHIEVEMENTS
     * ===================================================== */

    const updatedWinnerData =
      await usersData.get(
        winner.id
      );

    const achievements =
      await awardAchievements(
        usersData,
        winner.id,
        updatedWinnerData,
        fight,
        winner
      );

    const oldLevel =
      wStats.level;

    const lvlUp =
      newLevel > oldLevel
        ? `\n🆙 𝗟𝗘𝗩𝗘𝗟 𝗨𝗣! Now Lv.${newLevel}!`
        : "";

    const streakText =
      newStreak >= 2
        ? `\n🔥 Win Streak: ${newStreak}`
        : "";

    const achievementText =
      achievements.length >
      (wStats.achievements || []).length
        ? `\n🎖️ New Achievement Unlocked!`
        : "";

    await message.send(

      `🏆 𝗩𝗜𝗖𝗧𝗢𝗥𝗬!\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +

      `👑 ${winner.name} ` +
      `${forfeited ? "wins by forfeit" : "defeats"} ` +
      `${loser.name}!\n\n` +

      `${winnerRank.icon} Rank: ` +
      `${winnerRank.name}\n` +

      `💰 ${
        fight.mode === "bet"
          ? "𝗪𝗶𝗻𝗻𝗶𝗻𝗴𝘀"
          : "🎁 𝗣𝗿𝗶𝘇𝗲"
      }: $${winnings.toLocaleString()}\n` +

      `🏅 Victories: ${newWins}\n` +
      `✨ XP Gained: +${xpGain}` +

      lvlUp +

      streakText +

      achievementText +

      `\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎉 GG WP!`
    );
  }
};

/* =========================================================
 * TIMEOUT
 * ========================================================= */

function startTimeout(
  threadID,
  message
) {

  const id =
    setTimeout(
      async () => {

        if (
          !gameInstances.has(
            threadID
          )
        )
          return;

        const {
          fight
        } =
          gameInstances.get(
            threadID
          );

        await message.send(

          `⏰ 𝗧𝗜𝗠𝗘𝗢𝗨𝗧!\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Fight cancelled due to inactivity.\n` +
          (
            fight.mode === "bet"
              ? `💰 Bets refunded.`
              : ``
          )
        );

        if (
          fight.mode === "bet"
        ) {

          const ud =
            global.GoatBot.usersData;

          const [
            d0,
            d1
          ] =
            await Promise.all([

              ud.get(
                fight.participants[0].id
              ),

              ud.get(
                fight.participants[1].id
              )

            ]);

          await ud.set(
            fight.participants[0].id,
            {
              money:
                (d0.money || 0) +
                fight.challengerBet
            }
          );

          await ud.set(
            fight.participants[1].id,
            {
              money:
                (d1.money || 0) +
                fight.opponentBet
            }
          );
        }

        endFight(
          threadID
        );

      },
      TIMEOUT_SECONDS * 1000
    );

  const inst =
    gameInstances.get(
      threadID
    );

  if (inst)
    inst.timeoutID = id;
}

function resetTimeout(
  threadID,
  message
) {

  const inst =
    gameInstances.get(
      threadID
    );

  if (
    inst?.timeoutID
  ) {

    clearTimeout(
      inst.timeoutID
    );

    startTimeout(
      threadID,
      message
    );
  }
}

function endFight(
  threadID
) {

  const inst =
    gameInstances.get(
      threadID
    );

  if (
    inst?.timeoutID
  ) {

    clearTimeout(
      inst.timeoutID
    );
  }

  ongoingFights.delete(
    threadID
  );

  gameInstances.delete(
    threadID
  );
}