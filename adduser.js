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
                        const uid = await findUid(input);

                        if (uid)
                                return String(uid);
                } catch (error) {
                        const name = error?.name;

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

        throw new Error("CANNOT_GET_UID");
}


/*
 * ==========================================
 * GET GROUP STATE
 *
 * added  = actually inside group
 * pending = actually inside approval queue
 * failed = neither
 * ==========================================
 */

async function getGroupState(
        api,
        threadID,
        uid
) {
        try {
                const info =
                        await api.getThreadInfo(
                                String(threadID)
                        );

                /*
                 * Check actual members
                 */
                if (
                        Array.isArray(
                                info?.participantIDs
                        )
                ) {
                        const isMember =
                                info.participantIDs.some(
                                        id =>
                                                String(id) ===
                                                String(uid)
                                );

                        if (isMember)
                                return "added";
                }

                /*
                 * Check approval queue
                 */
                const queue =
                        Array.isArray(
                                info?.approvalQueue
                        )
                                ? info.approvalQueue
                                : [];

                const isPending =
                        queue.some(user => {
                                const pendingUID =
                                        user?.requesterID ??
                                        user?.requesterId ??
                                        user?.userID ??
                                        user?.userId ??
                                        user?.uid ??
                                        user?.id;

                                return (
                                        pendingUID &&
                                        String(
                                                pendingUID
                                        ) ===
                                        String(uid)
                                );
                        });

                if (isPending)
                        return "pending";

                return "failed";

        } catch (error) {
                console.error(
                        `[ADDUSER] getGroupState ${uid}:`,
                        error?.message || error
                );

                return "unknown";
        }
}


/*
 * ==========================================
 * VERIFY / WAIT FOR FACEBOOK UPDATE
 * ==========================================
 */

async function checkFinalState({
        api,
        threadID,
        uid
}) {
        /*
         * Facebook may need some time to update
         * participantIDs / approvalQueue.
         */
        for (let attempt = 1; attempt <= 5; attempt++) {
                const state =
                        await getGroupState(
                                api,
                                threadID,
                                uid
                        );

                if (
                        state === "added" ||
                        state === "pending"
                ) {
                        return state;
                }

                if (attempt < 5)
                        await sleep(1500);
        }

        return "failed";
}


/*
 * ==========================================
 * ADD USERS
 *
 * Shared by:
 * adduser
 * pnduser
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

        for (const rawUID of userIDs) {
                const uid =
                        String(rawUID).trim();

                if (!uid)
                        continue;

                /*
                 * Never add bot itself
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
                 * Check current state before add
                 */
                let currentState =
                        await getGroupState(
                                api,
                                threadID,
                                uid
                        );

                if (currentState === "added") {
                        failed.push({
                                uid,
                                reason:
                                        "Already in group."
                        });

                        continue;
                }

                if (currentState === "pending") {
                        sentForApproval.push(uid);
                        continue;
                }

                /*
                 * Actual add request
                 */
                try {
                        console.log(
                                `[ADDUSER] Adding ${uid} -> ${threadID}`
                        );

                        await api.addUserToGroup(
                                uid,
                                threadID
                        );

                        /*
                         * IMPORTANT:
                         *
                         * addUserToGroup() resolving does NOT
                         * automatically mean the user joined.
                         *
                         * Check Facebook's actual state.
                         */
                        const finalState =
                                await checkFinalState({
                                        api,
                                        threadID,
                                        uid
                                });

                        if (
                                finalState === "added"
                        ) {
                                added.push(uid);

                        } else if (
                                finalState === "pending"
                        ) {
                                sentForApproval.push(
                                        uid
                                );

                        } else {
                                failed.push({
                                        uid,
                                        reason:
                                                "User could not be added to the group."
                                });
                        }

                } catch (error) {
                        console.error(
                                `[ADDUSER] Failed ${uid}:`,
                                error?.message ||
                                        error
                        );

                        /*
                         * Even if API throws, check whether
                         * Facebook actually processed it.
                         */
                        const finalState =
                                await checkFinalState({
                                        api,
                                        threadID,
                                        uid
                                });

                        if (
                                finalState === "added"
                        ) {
                                added.push(uid);

                        } else if (
                                finalState === "pending"
                        ) {
                                sentForApproval.push(
                                        uid
                                );

                        } else {
                                failed.push({
                                        uid,
                                        reason:
                                                error?.message ||
                                                "Failed to add user."
                                });
                        }
                }

                await sleep(800);
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
                version: "4.0",
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
                                "⏳ %1 user(s) are waiting for group approval.",

                        failedAdd:
                                "❌ Failed to add %1 user(s):"
                }
        },


        /*
         * Export shared logic
         * pnduser will use this.
         */
        addUsers,


        /*
         * ======================================
         * ON START
         * ======================================
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
                         * ==================================
                         * REPLY SUPPORT
                         *
                         * adduser reply to:
                         *
                         * UID
                         * Facebook profile link
                         * text containing UID
                         * ==================================
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
                                 * If no UID,
                                 * try Facebook URL.
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
                         * No input
                         */
                        if (!inputs.length) {
                                return message.reply(
                                        "❌ Please provide a Facebook profile link or UID.\n\n" +
                                        "💡 You can also reply to a message containing a UID/profile link."
                                );
                        }


                        /*
                         * ==================================
                         * RESOLVE ALL INPUTS
                         * ==================================
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
                                                "[ADDUSER] UID:",
                                                error?.message ||
                                                        error
                                        );
                                }
                        }


                        /*
                         * No valid UID
                         */
                        if (!userIDs.length) {
                                return message.reply(
                                        "❌ Could not find any valid UID."
                                );
                        }


                        /*
                         * ==================================
                         * ADD
                         * ==================================
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
                         * ==================================
                         * RESULT MESSAGE
                         * ==================================
                         */

                        let msg = "";


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
                                result.sentForApproval
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
 * EXPORT HELPERS
 * ==========================================
 */

module.exports.resolveUID =
        resolveUID;

module.exports.getGroupState =
        getGroupState;