const adduserCommand = require("./adduser");
const addUsers = adduserCommand.addUsers;

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
            const threadID = String(event.threadID);

            const info = await api.getThreadInfo(threadID);

            const queue = Array.isArray(info?.approvalQueue)
                ? info.approvalQueue
                : [];

            if (!queue.length) {
                return message.reply(
                    "📭 | There are currently no users in the approval queue."
                );
            }

            const users = await makeUsers(api, queue);

            if (!users.length) {
                return message.reply(
                    "❌ | No valid pending user IDs were found."
                );
            }

            /*
             * pnduser all
             */
            if (
                String(args[0] || "").toLowerCase() === "all"
            ) {
                return processUsers({
                    message,
                    api,
                    threadID,
                    users
                });
            }

            /*
             * pnduser 1 3
             */
            if (args.length) {
                const indexes = parseIndexes(
                    args,
                    users.length
                );

                if (!indexes.length) {
                    return message.reply(
                        `❌ Invalid selection.\n\n` +
                        `Use:\n` +
                        `pnduser 1 3\n` +
                        `pnduser all`
                    );
                }

                const selected = indexes.map(
                    index => users[index - 1]
                );

                return processUsers({
                    message,
                    api,
                    threadID,
                    users: selected
                });
            }

            /*
             * Show pending list
             */
            let msg =
`╭────『 PENDING USERS 』────╮
 👥 Total: ${users.length}

`;

            for (const user of users) {
                msg +=
                    `〔 ${user.index} 〕 ${user.name}\n` +
                    `🆔 ${user.uid}\n\n`;
            }

            msg +=
`pnduser all
pnduser 1 2
or reply 1 2`;

            if (msg.length > 10000) {
                msg =
                    msg.slice(0, 9900) +
                    "\n\n⚠️ List truncated.";
            }

            const sent = await message.reply(msg);

            global.GoatBot.onReply.set(
                sent.messageID,
                {
                    commandName,
                    messageID: sent.messageID,
                    threadID,
                    author: String(event.senderID),
                    users
                }
            );

        } catch (error) {
            console.error(
                "[PNDUSER]",
                error
            );

            return message.reply(
                "❌ Failed to read approval queue.\n\n" +
                (error?.message || "Unknown error")
            );
        }
    },

    onReply: async function ({
        message,
        api,
        event,
        Reply
    }) {
        try {
            /*
             * Only original user can use the reply.
             */
            if (
                String(event.senderID) !==
                String(Reply.author)
            ) {
                return;
            }

            const input =
                String(event.body || "").trim();

            /*
             * Reply: all
             */
            if (
                input.toLowerCase() === "all"
            ) {
                return processUsers({
                    message,
                    api,
                    threadID: String(event.threadID),
                    users: Reply.users
                });
            }

            /*
             * Reply: 1 3
             */
            const indexes = parseIndexes(
                input.split(/\s+/),
                Reply.users.length
            );

            if (!indexes.length) {
                return message.reply(
                    `❌ Invalid selection.\n\n` +
                    `Available: 1-${Reply.users.length}\n` +
                    `Example: 1 3`
                );
            }

            const selected = indexes.map(
                index => Reply.users[index - 1]
            );

            return processUsers({
                message,
                api,
                threadID: String(event.threadID),
                users: selected
            });

        } catch (error) {
            console.error(
                "[PNDUSER REPLY]",
                error
            );

            return message.reply(
                "❌ Failed to process pending users.\n" +
                (error?.message || "Unknown error")
            );
        }
    }
};


/*
 * ==================================================
 * PROCESS USERS
 * ==================================================
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
    const unique = users.filter(
        (user, index, arr) =>
            arr.findIndex(
                item =>
                    String(item.uid) ===
                    String(user.uid)
            ) === index
    );

    /*
     * IMPORTANT:
     * Use the exact same add logic
     * from adduser.js.
     */
    const result = await addUsers({
        api,
        threadID,
        userIDs: unique.map(
            user => String(user.uid)
        )
    });

    let msg =
`╭──『 PENDING USER RESULT 』──╮`;

    if (result.added.length) {
        msg +=
            `\n│ ✅ Added: ${result.added.length}`;
    }

    if (result.sentForApproval.length) {
        msg +=
            `\n│ ⏳ Approval/Check: ${result.sentForApproval.length}`;
    }

    if (result.failed.length) {
        msg +=
            `\n│ ❌ Failed: ${result.failed.length}`;
    }

    msg +=
        `\n╰──────────────────────────╯\n\n`;

    /*
     * Successfully added
     */
    if (result.added.length) {
        msg +=
            `✅ Added successfully:\n`;

        msg += result.added
            .map(uid => `• ${uid}`)
            .join("\n");

        msg += "\n\n";
    }

    /*
     * Could not verify immediately
     */
    if (result.sentForApproval.length) {
        msg +=
            `⏳ Could not verify immediately:\n`;

        msg += result.sentForApproval
            .map(uid => `• ${uid}`)
            .join("\n");

        msg +=
            `\n⚠️ Please check the group approval list & add manually.\n\n`;
    }

    /*
     * Failed
     */
    if (result.failed.length) {
        msg +=
            `❌ Could not add:\n`;

        msg += result.failed
            .map(
                item =>
                    `• ${item.uid}\n` +
                    `  └ ${item.reason}`
            )
            .join("\n");

        msg += "\n";
    }

    return message.reply(
        msg.trim()
    );
}


/*
 * ==================================================
 * MAKE USER LIST
 * ==================================================
 */

async function makeUsers(
    api,
    queue
) {
    const users = [];

    for (const pending of queue) {
        const uid = getUID(pending);

        if (!uid)
            continue;

        const name = await getUserName(
            api,
            uid,
            pending
        );

        users.push({
            index: users.length + 1,
            uid,
            name
        });
    }

    return users;
}


/*
 * ==================================================
 * PARSE INDEXES
 * ==================================================
 */

function parseIndexes(
    values,
    max
) {
    const result = [];

    for (const value of values) {
        const n = Number.parseInt(
            String(value).trim(),
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
 * ==================================================
 * GET UID
 * ==================================================
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
 * ==================================================
 * GET USER NAME
 * ==================================================
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
        String(queueName).toLowerCase() !== "null"
    ) {
        return String(queueName);
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
                result?.[String(uid)] ||
                result?.[uid];

            if (data) {
                const name =
                    data.name ||
                    data.fullName ||
                    data.firstName;

                if (name) {
                    return String(name);
                }
            }

            /*
             * Some FCA versions may return array
             */
            if (Array.isArray(result)) {
                const data = result.find(
                    item =>
                        String(
                            item?.id ??
                            item?.uid ??
                            item?.userID
                        ) === String(uid)
                );

                if (data?.name) {
                    return String(data.name);
                }
            }
        }
    } catch (error) {
        console.log(
            `[PNDUSER] getUserInfo ${uid}:`,
            error?.message || error
        );
    }

    return `Facebook User (${uid})`;
}