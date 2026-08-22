const { findUid } = global.utils;

const sleep = ms =>
        new Promise(resolve => setTimeout(resolve, ms));


/*
 * ==========================================
 * RESOLVE UID
 * ==========================================
 */

async function resolveUID(input) {
        input = String(input).trim();

        if (/^\d+$/.test(input))
                return input;

        const regEx =
                /(?:https?:\/\/)?(?:www\.)?(?:facebook|fb|m\.facebook)\.(?:com|me)\/(?:(?:\w)*#!\/)?(?:pages\/)?(?:[\w\-]*\/)*([\w\-\.]+)(?:\/)?/i;

        if (!regEx.test(input))
                throw new Error("INVALID_LINK");

        for (let attempt = 1; attempt <= 10; attempt++) {
                try {
                        const uid =
                                await findUid(input);

                        if (uid)
                                return String(uid);

                } catch (error) {
                        const name =
                                error?.name;

                        if (
                                (
                                        name === "SlowDown" ||
                                        name === "CannotGetData"
                                ) &&
                                attempt < 10
                        ) {
                                await sleep(1000);
                                continue;
                        }

                        throw error;
                }
        }

        throw new Error(
                "CANNOT_GET_UID"
        );
}


/*
 * ==========================================
 * CHECK IF USER IS PENDING
 * ==========================================
 */

async function isPending(
        api,
        threadID,
        uid
) {
        try {
                const info =
                        await api.getThreadInfo(
                                String(threadID)
                        );

                const queue =
                        Array.isArray(
                                info?.approvalQueue
                        )
                                ? info.approvalQueue
                                : [];

                return queue.some(
                        user => {
                                const id =
                                        user?.requesterID ??
                                        user?.requesterId ??
                                        user?.userID ??
                                        user?.userId ??
                                        user?.uid ??
                                        user?.id;

                                return (
                                        id &&
                                        String(id) ===
                                        String(uid)
                                );
                        }
                );

        } catch (error) {
                console.log(
                        `[ADDUSER] Pending check ${uid}:`,
                        error?.message ||
                                error
                );

                return false;
        }
}


/*
 * ==========================================
 * ADD USERS
 *
 * Shared by adduser + pnduser
 * ==========================================
 */

async function addUsers({
        api,
        threadID,
        userIDs
}) {
        const botID =
                String(
                        api.getCurrentUserID()
                );

        const added = [];
        const sentForApproval = [];
        const failed = [];

        for (
                const rawUID
                of userIDs
        ) {
                const uid =
                        String(
                                rawUID
                        ).trim();

                if (!uid)
                        continue;


                /*
                 * ======================================
                 * BOT CHECK
                 * ======================================
                 */

                if (uid === botID) {
                        failed.push({
                                uid,
                                reason:
                                        "Bot is already in this group."
                        });

                        continue;
                }


                /*
                 * ======================================
                 * PRE-CHECK
                 * ======================================
                 *
                 * Only one getThreadInfo.
                 * No long verification loop.
                 */

                try {
                        const info =
                                await api.getThreadInfo(
                                        String(
                                                threadID
                                        )
                                );


                        /*
                         * Already member
                         */

                        if (
                                Array.isArray(
                                        info?.participantIDs
                                ) &&
                                info.participantIDs.some(
                                        id =>
                                                String(
                                                        id
                                                ) === uid
                                )
                        ) {
                                failed.push({
                                        uid,
                                        reason:
                                                "Already in group."
                                });

                                continue;
                        }


                        /*
                         * Already pending
                         */

                        const queue =
                                Array.isArray(
                                        info?.approvalQueue
                                )
                                        ? info.approvalQueue
                                        : [];

                        const pending =
                                queue.some(
                                        user => {
                                                const id =
                                                        user?.requesterID ??
                                                        user?.requesterId ??
                                                        user?.userID ??
                                                        user?.userId ??
                                                        user?.uid ??
                                                        user?.id;

                                                return (
                                                        id &&
                                                        String(
                                                                id
                                                        ) === uid
                                                );
                                        }
                                );

                        if (pending) {
                                sentForApproval.push(
                                        uid
                                );

                                continue;
                        }

                } catch (error) {
                        console.log(
                                "[ADDUSER] Pre-check:",
                                error?.message ||
                                        error
                        );
                }


                /*
                 * ======================================
                 * ACTUAL ADD REQUEST
                 * ======================================
                 */

                try {
                        console.log(
                                `[ADDUSER] Adding ${uid} -> ${threadID}`
                        );

                        await api.addUserToGroup(
                                uid,
                                String(
                                        threadID
                                )
                        );


                        /*
                         * IMPORTANT
                         *
                         * Do NOT wait for participantIDs.
                         *
                         * wonfca resolving the add request
                         * means the request was accepted by
                         * the API/Facebook transport.
                         */

                        added.push(
                                uid
                        );

                        console.log(
                                `[ADDUSER] Add request successful: ${uid}`
                        );

                } catch (error) {
                        console.error(
                                `[ADDUSER] Failed ${uid}:`,
                                error?.message ||
                                        error
                        );


                        /*
                         * API threw an error.
                         *
                         * Quickly check whether Facebook
                         * actually placed the user into
                         * approval queue.
                         */

                        const pending =
                                await isPending(
                                        api,
                                        threadID,
                                        uid
                                );

                        if (pending) {
                                sentForApproval.push(
                                        uid
                                );

                        } else {
                                failed.push({
                                        uid,
                                        reason:
                                                error?.message ||
                                                "Facebook rejected the add request."
                                });
                        }
                }


                /*
                 * Small delay only when adding multiple users.
                 *
                 * No 10-second verification.
                 */

                if (
                        userIDs.length > 1
                ) {
                        await sleep(300);
                }
        }

        return {
                added,
                sentForApproval,
                failed
        };
}


/*
 * ==========================================
 * COMMAND
 * ==========================================
 */

module.exports = {
        config: {
                name: "adduser",
                version: "5.0",
                author: "Rakib",
                countDown: 5,
                role: 1,

                description: {
                        en:
                                "Add user to group chat"
                },

                category: "box chat",

                guide: {
                        en:
                                "{pn} [uid | Facebook profile link]\n" +
                                "Reply to a message containing UID/profile link to add that user."
                }
        },


        langs: {
                en: {
                        successAdd:
                                "✅ Successfully added %1 user(s) to the group.",

                        waitApproval:
                                "⏳ %1 user(s) could not be added and are waiting for group approval.",

                        failedAdd:
                                "❌ Failed to add %1 user(s):"
                }
        },


        /*
         * Export shared logic.
         *
         * pnduser.js uses this same function.
         */

        addUsers,


        /*
         * ==========================================
         * ON START
         * ==========================================
         */

        onStart: async function ({
                message,
                api,
                event,
                args
        }) {
                try {
                        let inputs =
                                [...args];


                        /*
                         * ======================================
                         * REPLY SUPPORT
                         * ======================================
                         *
                         * adduser reply to:
                         *
                         * UID
                         * Facebook UID
                         * Facebook profile link
                         * Text containing UID
                         */

                        const reply =
                                event.messageReply;

                        if (
                                !inputs.length &&
                                reply
                        ) {
                                const body =
                                        String(
                                                reply.body ||
                                                ""
                                        ).trim();


                                /*
                                 * Extract UID(s)
                                 */

                                const ids =
                                        body.match(
                                                /\b\d{10,}\b/g
                                        );

                                if (
                                        ids?.length
                                ) {
                                        inputs.push(
                                                ...ids
                                        );
                                }


                                /*
                                 * Otherwise try
                                 * Facebook URL.
                                 */

                                else if (
                                        body
                                ) {
                                        inputs.push(
                                                body
                                        );
                                }
                        }


                        /*
                         * ======================================
                         * NO INPUT
                         * ======================================
                         */

                        if (
                                !inputs.length
                        ) {
                                return message.reply(
                                        "❌ Please provide a Facebook profile link or UID.\n\n" +
                                        "💡 You can also reply to a message containing a UID/profile link."
                                );
                        }


                        /*
                         * ======================================
                         * RESOLVE ALL UIDs
                         * ======================================
                         */

                        const userIDs =
                                [];

                        for (
                                const input
                                of inputs
                        ) {
                                try {
                                        const uid =
                                                await resolveUID(
                                                        input
                                                );

                                        if (
                                                uid &&
                                                !userIDs.includes(
                                                        String(
                                                                uid
                                                        )
                                                )
                                        ) {
                                                userIDs.push(
                                                        String(
                                                                uid
                                                        )
                                                );
                                        }

                                } catch (error) {
                                        console.error(
                                                "[ADDUSER] UID resolve:",
                                                error?.message ||
                                                        error
                                        );
                                }
                        }


                        /*
                         * No valid UID
                         */

                        if (
                                !userIDs.length
                        ) {
                                return message.reply(
                                        "❌ Could not find any valid UID."
                                );
                        }


                        /*
                         * ======================================
                         * ADD USERS
                         * ======================================
                         */

                        const result =
                                await addUsers({
                                        api,
                                        threadID:
                                                String(
                                                        event.threadID
                                                ),
                                        userIDs
                                });


                        /*
                         * ======================================
                         * BUILD RESULT
                         * ======================================
                         */

                        let msg =
                                "";


                        /*
                         * SUCCESS
                         */

                        if (
                                result.added.length
                        ) {
                                msg +=
                                        `✅ Successfully added ${result.added.length} user(s) to the group.\n` +
                                        `🆔 ${result.added.join(", ")}\n\n`;
                        }


                        /*
                         * PENDING
                         */

                        if (
                                result
                                        .sentForApproval
                                        .length
                        ) {
                                msg +=
                                        `⏳ ${result.sentForApproval.length} user(s) could not be added and are waiting for group approval.\n` +
                                        `🆔 ${result.sentForApproval.join(", ")}\n` +
                                        `⚠️ Please check the group approval/pending list.\n\n`;
                        }


                        /*
                         * FAILED
                         */

                        if (
                                result.failed.length
                        ) {
                                msg +=
                                        `❌ Failed to add ${result.failed.length} user(s):\n`;

                                for (
                                        const item
                                        of result.failed
                                ) {
                                        msg +=
                                                `• ${item.uid}\n` +
                                                `  └ ${item.reason}\n`;
                                }
                        }


                        /*
                         * Nothing
                         */

                        if (!msg) {
                                msg =
                                        "❌ No users were processed.";
                        }


                        return message.reply(
                                msg.trim()
                        );

                } catch (error) {
                        console.error(
                                "[ADDUSER]",
                                error
                        );

                        return message.reply(
                                "❌ Add user failed.\n" +
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
 * OPTIONAL EXPORTS
 * ==========================================
 */

module.exports.resolveUID =
        resolveUID;

module.exports.isPending =
        isPending;