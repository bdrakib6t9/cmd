function sleep(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

/*
 * =========================================================
 * NORMALIZE ADMIN IDS
 * =========================================================
 */

function normalizeIDs(list) {
    if (!Array.isArray(list)) return [];

    return list
        .map(item => {
            if (item && typeof item === "object") {
                return String(item.id || item.userID || "");
            }

            return String(item || "");
        })
        .filter(Boolean);
}

/*
 * =========================================================
 * GET FRESH THREAD INFO WITH RETRY
 * =========================================================
 *
 * Facebook/FCA sometimes returns stale thread information
 * immediately after the bot receives admin permission.
 *
 * So we retry a few times before declaring that the bot
 * is not an admin.
 */

async function getFreshThreadInfo(api, threadID, retries = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const info = await api.getThreadInfo(threadID);

            if (info) {
                return info;
            }
        }
        catch (error) {
            lastError = error;

            console.error(
                `[filteruser] getThreadInfo attempt ${attempt} failed:`,
                error
            );
        }

        if (attempt < retries) {
            await sleep(1000);
        }
    }

    throw lastError || new Error("Unable to get thread information");
}

/*
 * =========================================================
 * BOT ADMIN CHECK
 * =========================================================
 *
 * Strategy:
 *
 * 1. Check local threadsData first.
 * 2. If bot is already admin in cache, accept it.
 * 3. Otherwise request fresh FCA information.
 * 4. Retry fresh FCA information because Facebook can return
 *    stale admin information immediately after permission changes.
 * 5. If fresh FCA confirms admin, use that information.
 */

async function getBotAdminInfo({
    api,
    threadsData,
    threadID,
    botID,
    needUserInfo = false
}) {
    let cachedThreadData = null;
    let cachedAdminIDs = [];

    /*
     * -------------------------------------------------------
     * LOCAL CACHE
     * -------------------------------------------------------
     */

    try {
        cachedThreadData = await threadsData.get(threadID);

        cachedAdminIDs = normalizeIDs(
            cachedThreadData?.adminIDs
        );
    }
    catch (error) {
        cachedThreadData = null;
        cachedAdminIDs = [];

        console.error(
            `[filteruser] threadsData.get failed for ${threadID}:`,
            error
        );
    }

    /*
     * -------------------------------------------------------
     * CACHE SAYS BOT IS ADMIN
     * -------------------------------------------------------
     *
     * If userInfo is NOT required, cache is enough.
     */

    if (
        cachedAdminIDs.includes(String(botID)) &&
        !needUserInfo
    ) {
        return {
            isAdmin: true,
            adminIDs: cachedAdminIDs,
            threadInfo: null,
            source: "cache"
        };
    }

    /*
     * -------------------------------------------------------
     * FRESH FCA CHECK
     * -------------------------------------------------------
     */

    try {
        const freshInfo = await getFreshThreadInfo(
            api,
            threadID,
            3
        );

        const freshAdminIDs = normalizeIDs(
            freshInfo?.adminIDs
        );

        const isAdmin = freshAdminIDs.includes(
            String(botID)
        );

        /*
         * ---------------------------------------------------
         * IMPORTANT
         * ---------------------------------------------------
         *
         * If FCA confirms admin, use fresh information.
         *
         * If userInfo is needed, this same threadInfo is
         * returned so we don't need another API request.
         */

        if (isAdmin) {
            return {
                isAdmin: true,
                adminIDs: freshAdminIDs,
                threadInfo: freshInfo,
                source: "fca"
            };
        }

        /*
         * ---------------------------------------------------
         * CACHE FALLBACK
         * ---------------------------------------------------
         *
         * Sometimes FCA can temporarily return incomplete
         * admin information. If our local cache already knows
         * the bot is admin, don't unnecessarily block it.
         */

        if (cachedAdminIDs.includes(String(botID))) {
            return {
                isAdmin: true,
                adminIDs: cachedAdminIDs,
                threadInfo: needUserInfo
                    ? freshInfo
                    : null,
                source: "cache-fallback"
            };
        }

        return {
            isAdmin: false,
            adminIDs: freshAdminIDs,
            threadInfo: freshInfo,
            source: "fca"
        };
    }
    catch (error) {
        /*
         * ---------------------------------------------------
         * FCA FAILED
         * ---------------------------------------------------
         */

        if (cachedAdminIDs.includes(String(botID))) {
            return {
                isAdmin: true,
                adminIDs: cachedAdminIDs,
                threadInfo: null,
                source: "cache-error-fallback"
            };
        }

        return {
            isAdmin: false,
            adminIDs: cachedAdminIDs,
            threadInfo: null,
            source: "error",
            error
        };
    }
}

module.exports = {
    config: {
        name: "filteruser",
        version: "2.2",
        aliases: ["filter", "flt"],
        author: "Hoon",
        countDown: 5,
        role: 1,

        description: {
            vi: "Lọc thành viên nhóm theo số tin nhắn hoặc tài khoản đã vô hiệu hóa",
            en: "Filter group members by message count or deactivated accounts"
        },

        category: "box chat",

        guide: {
            vi:
                "   {pn} — Xóa tài khoản đã vô hiệu hóa\n" +
                "   {pn} [số tin nhắn] — Xóa thành viên có ít hơn số tin nhắn",

            en:
                "   {pn} — Remove deactivated accounts\n" +
                "   {pn} [number] — Remove members with fewer messages"
        }
    },

    langs: {
        vi: {
            confirm:
                "⚠️ | Bạn có chắc chắn muốn xóa thành viên có số tin nhắn nhỏ hơn %1 không?\n" +
                "Thả cảm xúc vào tin nhắn này để xác nhận.",

            kickByBlock:
                "✅ | Đã xóa %1 tài khoản đã vô hiệu hóa.",

            kickByMsg:
                "✅ | Đã xóa %1 thành viên có số tin nhắn nhỏ hơn %2.",

            kickError:
                "❌ | Không thể xóa %1 thành viên:\n%2",

            noBlock:
                "✅ | Không tìm thấy tài khoản đã vô hiệu hóa.",

            noMsg:
                "✅ | Không có thành viên nào có số tin nhắn nhỏ hơn %1.",

            noAdmin:
                "⚠️ | Bot cần được cấp quyền quản trị nhóm trước."
        },

        en: {
            confirm:
                "⚠️ | Are you sure you want to remove members with fewer than %1 messages?\n" +
                "React to this message to confirm.",

            kickByBlock:
                "✅ | Successfully removed %1 deactivated accounts.",

            kickByMsg:
                "✅ | Successfully removed %1 members with fewer than %2 messages.",

            kickError:
                "❌ | Failed to remove %1 members:\n%2",

            noBlock:
                "✅ | No deactivated accounts found.",

            noMsg:
                "✅ | No members have fewer than %1 messages.",

            noAdmin:
                "⚠️ | Bot needs group admin permission first."
        }
    },

    // =========================================================
    // COMMAND START
    // =========================================================

    onStart: async function ({
        api,
        args,
        threadsData,
        message,
        event,
        commandName,
        getLang
    }) {
        const threadID = String(event.threadID);
        const botID = String(api.getCurrentUserID());

        /*
         * -----------------------------------------------------
         * ADMIN CHECK
         * -----------------------------------------------------
         */

        const adminCheck = await getBotAdminInfo({
            api,
            threadsData,
            threadID,
            botID,
            needUserInfo: !args[0]
        });

        if (!adminCheck.isAdmin) {
            return message.reply(getLang("noAdmin"));
        }

        let adminIDs = adminCheck.adminIDs;
        let threadInfo = adminCheck.threadInfo;

        /*
         * =====================================================
         * NO ARGUMENT
         * REMOVE DEACTIVATED ACCOUNTS
         * =====================================================
         */

        if (!args[0]) {

            /*
             * getBotAdminInfo() normally already gives us
             * fresh threadInfo when userInfo is required.
             *
             * Fallback only if it somehow wasn't returned.
             */

            if (!threadInfo) {
                try {
                    threadInfo = await getFreshThreadInfo(
                        api,
                        threadID,
                        3
                    );
                }
                catch (error) {
                    console.error(
                        `[filteruser] Failed to get thread info ${threadID}:`,
                        error
                    );

                    return message.reply(
                        "❌ Failed to get fresh group information."
                    );
                }

                adminIDs = normalizeIDs(
                    threadInfo?.adminIDs
                );

                /*
                 * Final admin verification.
                 */

                if (!adminIDs.includes(botID)) {
                    return message.reply(
                        getLang("noAdmin")
                    );
                }
            }

            /*
             * -------------------------------------------------
             * USER INFO
             * -------------------------------------------------
             */

            const userInfo = Array.isArray(threadInfo?.userInfo)
                ? threadInfo.userInfo
                : [];

            if (!Array.isArray(threadInfo?.userInfo)) {
                return message.reply(
                    "❌ Failed to get group member information."
                );
            }

            /*
             * -------------------------------------------------
             * FIND DEACTIVATED USERS
             * -------------------------------------------------
             */

            const deactivatedMembers = userInfo.filter(user => {

                const userID = String(user?.id || "");
                const userType = String(user?.type || "");

                if (!userID) return false;

                /*
                 * Never kick bot.
                 */
                if (userID === botID) return false;

                /*
                 * Never kick admins.
                 */
                if (adminIDs.includes(userID)) return false;

                /*
                 * Deactivated account.
                 */
                return userType === "UnavailableMessagingActor";
            });

            if (deactivatedMembers.length === 0) {
                return message.reply(
                    getLang("noBlock")
                );
            }

            const success = [];
            const errors = [];

            /*
             * -------------------------------------------------
             * KICK DEACTIVATED USERS
             * -------------------------------------------------
             */

            for (const user of deactivatedMembers) {

                const userID = String(user.id);

                /*
                 * Final safety check.
                 */

                if (
                    !userID ||
                    userID === botID ||
                    adminIDs.includes(userID)
                ) {
                    continue;
                }

                try {
                    await api.removeUserFromGroup(
                        userID,
                        threadID
                    );

                    success.push(
                        user.name || userID
                    );
                }
                catch (error) {
                    errors.push(
                        user.name || userID
                    );

                    console.error(
                        `[filteruser] Failed to kick ${userID} from ${threadID}:`,
                        error
                    );
                }

                await sleep(700);
            }

            let result = "";

            if (success.length) {
                result +=
                    getLang(
                        "kickByBlock",
                        success.length
                    ) + "\n";
            }

            if (errors.length) {
                result +=
                    getLang(
                        "kickError",
                        errors.length,
                        errors.join("\n")
                    );
            }

            return message.reply(
                result.trim()
            );
        }

        /*
         * =====================================================
         * NUMBER = FILTER LOW MESSAGE USERS
         * =====================================================
         */

        const minimum = Number(args[0]);

        /*
         * Minimum must be a positive integer.
         */

        if (
            !Number.isInteger(minimum) ||
            minimum < 1
        ) {
            return message.SyntaxError();
        }

        message.reply(
            getLang("confirm", minimum),
            (err, info) => {

                if (
                    err ||
                    !info?.messageID
                ) {
                    return;
                }

                global.GoatBot.onReaction.set(
                    info.messageID,
                    {
                        author: String(event.senderID),
                        messageID: info.messageID,
                        minimum,
                        commandName
                    }
                );
            }
        );
    },

    // =========================================================
    // REACTION CONFIRMATION
    // =========================================================

    onReaction: async function ({
        api,
        Reaction,
        event,
        threadsData,
        message,
        getLang
    }) {
        const {
            minimum = 1,
            author
        } = Reaction;

        /*
         * Only command author can confirm.
         */

        if (
            String(event.userID) !==
            String(author)
        ) {
            return;
        }

        const threadID = String(event.threadID);
        const botID = String(api.getCurrentUserID());

        /*
         * -----------------------------------------------------
         * FRESH ADMIN CHECK
         * -----------------------------------------------------
         */

        const adminCheck = await getBotAdminInfo({
            api,
            threadsData,
            threadID,
            botID,
            needUserInfo: false
        });

        if (!adminCheck.isAdmin) {
            return message.reply(
                getLang("noAdmin")
            );
        }

        const adminIDs = adminCheck.adminIDs;

        /*
         * -----------------------------------------------------
         * GET THREAD DATA
         * -----------------------------------------------------
         */

        let threadData;

        try {
            threadData = await threadsData.get(
                threadID
            );
        }
        catch (error) {
            console.error(
                `[filteruser] Failed to get thread data ${threadID}:`,
                error
            );

            return message.reply(
                "❌ Failed to get thread data."
            );
        }

        const members = Array.isArray(
            threadData?.members
        )
            ? threadData.members
            : [];

        /*
         * -----------------------------------------------------
         * FIND LOW MESSAGE USERS
         * -----------------------------------------------------
         */

        const membersCountLess =
            members.filter(member => {

                const userID = String(
                    member?.userID || ""
                );

                const count = Number(
                    member?.count
                );

                if (!userID) return false;

                /*
                 * Never kick bot.
                 */

                if (userID === botID) {
                    return false;
                }

                /*
                 * Must currently be in group.
                 */

                if (!member.inGroup) {
                    return false;
                }

                /*
                 * Never kick admins.
                 */

                if (adminIDs.includes(userID)) {
                    return false;
                }

                /*
                 * Invalid count isn't low activity.
                 */

                if (!Number.isFinite(count)) {
                    return false;
                }

                return count < minimum;
            });

        if (
            membersCountLess.length === 0
        ) {
            return message.reply(
                getLang(
                    "noMsg",
                    minimum
                )
            );
        }

        const success = [];
        const errors = [];

        /*
         * -----------------------------------------------------
         * KICK LOW MESSAGE USERS
         * -----------------------------------------------------
         */

        for (
            const member of membersCountLess
        ) {
            const userID = String(
                member.userID
            );

            /*
             * Final safety check.
             */

            if (
                !userID ||
                userID === botID ||
                adminIDs.includes(userID)
            ) {
                continue;
            }

            try {
                await api.removeUserFromGroup(
                    userID,
                    threadID
                );

                success.push(
                    member.name || userID
                );
            }
            catch (error) {
                errors.push(
                    member.name || userID
                );

                console.error(
                    `[filteruser] Failed to kick ${userID} from ${threadID}:`,
                    error
                );
            }

            await sleep(700);
        }

        /*
         * -----------------------------------------------------
         * RESULT
         * -----------------------------------------------------
         */

        let result = "";

        if (success.length) {
            result +=
                getLang(
                    "kickByMsg",
                    success.length,
                    minimum
                ) + "\n";
        }

        if (errors.length) {
            result +=
                getLang(
                    "kickError",
                    errors.length,
                    errors.join("\n")
                );
        }

        if (!result) {
            result = getLang(
                "noMsg",
                minimum
            );
        }

        return message.reply(
            result.trim()
        );
    }
};