const adduserCommand =
        require("./adduser");

const addUsers =
        adduserCommand.addUsers;

module.exports = {
        config: {
                name: "pnduser",
                aliases: ["ap"],
                version: "5.0",
                author: "Rakib",
                countDown: 5,
                role: 1,

                description: {
                        en: "View and add pending group users"
                },

                category: "box chat",

                guide: {
                        en:
                                "{pn} - Show pending users\n" +
                                "{pn} all - Add all pending users\n" +
                                "{pn} 1 3 - Add users 1 and 3\n" +
                                "Reply 1 3 - Add users 1 and 3"
                }
        },

        onStart: async function ({
                message,
                api,
                event,
                args,
                commandName
        }) {
                try {
                        const threadID =
                                String(event.threadID);

                        const info =
                                await api.getThreadInfo(
                                        threadID
                                );

                        const queue =
                                Array.isArray(
                                        info?.approvalQueue
                                )
                                        ? info.approvalQueue
                                        : [];

                        if (!queue.length) {
                                return message.reply(
                                        "📭 | There are currently no users in the approval queue."
                                );
                        }

                        const users =
                                await makeUsers(
                                        api,
                                        queue
                                );

                        if (!users.length) {
                                return message.reply(
                                        "❌ | No valid pending user IDs were found."
                                );
                        }

                        /*
                         * ==========================================
                         * pnduser all
                         * ==========================================
                         */

                        if (
                                String(
                                        args[0] || ""
                                ).toLowerCase() ===
                                "all"
                        ) {
                                return processUsers({
                                        message,
                                        api,
                                        threadID,
                                        users
                                });
                        }

                        /*
                         * ==========================================
                         * pnduser 1 3
                         * ==========================================
                         */

                        if (args.length) {
                                const indexes =
                                        parseIndexes(
                                                args,
                                                users.length
                                        );

                                if (!indexes.length) {
                                        return message.reply(
                                                `❌ Invalid selection.\n\nUse:\n• pnduser\n• pnduser all\n• pnduser 1 3`
                                        );
                                }

                                const selected =
                                        indexes.map(
                                                index =>
                                                        users[
                                                                index - 1
                                                        ]
                                        );

                                return processUsers({
                                        message,
                                        api,
                                        threadID,
                                        users:
                                                selected
                                });
                        }

                        /*
                         * ==========================================
                         * SHOW LIST
                         * ==========================================
                         */

                        let msg =
`╭────『 PENDING USERS 』────╮
│ 👥 Total: ${users.length}
│
│ pnduser all
│ pnduser 1 3
│
│ Or reply:
│ 1 3
╰──────────────────────────╯

`;

                        for (const user of users) {
                                msg +=
                                        `〔 ${user.index} 〕 ${user.name}\n` +
                                        `🆔 ${user.uid}\n\n`;
                        }

                        if (msg.length > 10000) {
                                msg =
                                        msg.slice(
                                                0,
                                                9900
                                        ) +
                                        "\n\n⚠️ List truncated.";
                        }

                        const sent =
                                await message.reply(
                                        msg
                                );

                        /*
                         * Save reply data
                         */
                        if (
                                global.GoatBot &&
                                global.GoatBot.onReply
                        ) {
                                global.GoatBot.onReply.set(
                                        sent.messageID,
                                        {
                                                commandName,
                                                messageID:
                                                        sent.messageID,
                                                threadID,
                                                author:
                                                        String(
                                                                event.senderID
                                                        ),
                                                users
                                        }
                                );
                        }
                } catch (error) {
                        console.error(
                                "[PNDUSER]",
                                error
                        );

                        return message.reply(
                                "❌ Failed to read approval queue.\n\n" +
                                        (
                                                error?.message ||
                                                "Unknown error"
                                        )
                        );
                }
        },

        /*
         * ==========================================
         * REPLY
         * ==========================================
         */

        onReply: async function ({
                message,
                api,
                event,
                Reply
        }) {
                try {
                        if (
                                String(
                                        event.senderID
                                ) !==
                                String(
                                        Reply.author
                                )
                        ) {
                                return;
                        }

                        const input =
                                String(
                                        event.body || ""
                                ).trim();

                        /*
                         * Reply "all"
                         */
                        if (
                                input.toLowerCase() ===
                                "all"
                        ) {
                                return processUsers({
                                        message,
                                        api,
                                        threadID:
                                                String(
                                                        event.threadID
                                                ),
                                        users:
                                                Reply.users
                                });
                        }

                        /*
                         * Reply "1 3"
                         */
                        const indexes =
                                parseIndexes(
                                        input.split(
                                                /\s+/
                                        ),
                                        Reply.users
                                                .length
                                );

                        if (!indexes.length) {
                                return message.reply(
                                        `❌ Invalid selection.\n\nAvailable: 1-${Reply.users.length}\nExample: 1 3`
                                );
                        }

                        const selected =
                                indexes.map(
                                        index =>
                                                Reply.users[
                                                        index - 1
                                                ]
                                );

                        return processUsers({
                                message,
                                api,
                                threadID:
                                        String(
                                                event.threadID
                                        ),
                                users:
                                        selected
                        });
                } catch (error) {
                        console.error(
                                "[PNDUSER REPLY]",
                                error
                        );

                        return message.reply(
                                "❌ Failed to process pending users.\n\n" +
                                        (
                                                error?.message ||
                                                "Unknown error"
                                        )
                        );
                }
        }
};

/*
 * ==========================================
 * PROCESS USERS
 * ==========================================
 */

async function processUsers({
        message,
        api,
        threadID,
        users
}) {
        if (!users?.length) {
                return message.reply(
                        "❌ No users selected."
                );
        }

        /*
         * Remove duplicate UID
         */
        const unique =
                users.filter(
                        (user, index, arr) =>
                                arr.findIndex(
                                        item =>
                                                String(
                                                        item.uid
                                                ) ===
                                                String(
                                                        user.uid
                                                )
                                ) === index
                );

        const result =
                await addUsers({
                        api,
                        threadID,
                        userIDs:
                                unique.map(
                                        user =>
                                                String(
                                                        user.uid
                                                )
                                )
                });

        let msg =
`╭──『 PENDING USER RESULT 』──╮`;

        if (result.added.length) {
                msg +=
                        `\n│ ✅ Added: ${result.added.length}`;
        }

        if (
                result.checkApproval.length
        ) {
                msg +=
                        `\n│ ⚠️ Not verified: ${result.checkApproval.length}`;
        }

        if (result.failed.length) {
                msg +=
                        `\n│ ❌ Failed: ${result.failed.length}`;
        }

        msg +=
                `\n╰──────────────────────────╯\n\n`;

        /*
         * Added
         */
        if (result.added.length) {
                msg +=
                        `✅ Added successfully:\n` +
                        result.added
                                .map(
                                        uid =>
                                                `• ${uid}`
                                )
                                .join("\n") +
                        "\n\n";
        }

        /*
         * Could not verify
         */
        if (
                result.checkApproval.length
        ) {
                msg +=
                        `⚠️ Could not verify as added:\n` +
                        result.checkApproval
                                .map(
                                        uid =>
                                                `• ${uid}`
                                )
                                .join("\n") +
                        "\n` +
                        `Please check the group approval/pending list.\n\n`;
        }

        /*
         * Failed
         */
        if (result.failed.length) {
                msg +=
                        `❌ Failed:\n` +
                        result.failed
                                .map(
                                        item =>
                                                `• ${item.uid} — ${item.reason}`
                                )
                                .join("\n");
        }

        return message.reply(
                msg.trim()
        );
}

/*
 * ==========================================
 * MAKE USER LIST
 * ==========================================
 */

async function makeUsers(
        api,
        queue
) {
        const users = [];

        for (
                let i = 0;
                i < queue.length;
                i++
        ) {
                const pending =
                        queue[i];

                const uid =
                        getUID(pending);

                if (!uid)
                        continue;

                const name =
                        await getUserName(
                                api,
                                uid,
                                pending
                        );

                users.push({
                        index:
                                users.length + 1,
                        uid,
                        name
                });
        }

        return users;
}

/*
 * ==========================================
 * PARSE INDEXES
 * ==========================================
 */

function parseIndexes(
        values,
        max
) {
        const result = [];

        for (const value of values) {
                const n =
                        Number.parseInt(
                                String(value)
                                        .trim(),
                                10
                        );

                if (
                        Number.isInteger(n) &&
                        n >= 1 &&
                        n <= max &&
                        !result.includes(n)
                ) {
                        result.push(n);
                }
        }

        return result;
}

/*
 * ==========================================
 * GET UID
 * ==========================================
 */

function getUID(user) {
        if (!user)
                return null;

        const uid =
                user.requesterID ??
                user.requesterId ??
                user.userID ??
                user.userId ??
                user.uid ??
                user.id;

        return uid
                ? String(uid)
                : null;
}

/*
 * ==========================================
 * GET USER NAME
 * ==========================================
 */

async function getUserName(
        api,
        uid,
        queueUser
) {
        const queueName =
                queueUser?.name ||
                queueUser?.fullName ||
                queueUser?.displayName;

        if (
                queueName &&
                String(queueName)
                        .toLowerCase() !==
                "null"
        ) {
                return String(
                        queueName
                );
        }

        try {
                if (
                        typeof api.getUserInfo ===
                        "function"
                ) {
                        const result =
                                await api.getUserInfo([
                                        String(uid)
                                ]);

                        const data =
                                result?.[
                                        String(uid)
                                ] ||
                                result?.[uid];

                        if (data) {
                                const name =
                                        data.name ||
                                        data.fullName ||
                                        data.firstName;

                                if (name)
                                        return String(
                                                name
                                        );
                        }

                        if (Array.isArray(result)) {
                                const data =
                                        result.find(
                                                item =>
                                                        String(
                                                                item?.id ??
                                                                        item?.uid ??
                                                                        item?.userID
                                                        ) ===
                                                        String(
                                                                uid
                                                        )
                                        );

                                if (data?.name)
                                        return String(
                                                data.name
                                        );
                        }
                }
        } catch (error) {
                console.log(
                        `[PNDUSER] getUserInfo ${uid}:`,
                        error?.message ||
                                error
                );
        }

        return `Facebook User (${uid})`;
}