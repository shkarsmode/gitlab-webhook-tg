const axios = require("axios");
const crypto = require("crypto");

// GitLab sends the hook's "Secret token" in X-Gitlab-Token. Without checking it, anyone on the
// internet could post fake deploy messages — with links of their choosing — into the team chat.
// Both sides are hashed first so the comparison is constant-time whatever the lengths.
function fromGitLab(req) {
    const expected = process.env.GITLAB_WEBHOOK_SECRET || "";
    if (!expected) return false;
    const digest = (s) => crypto.createHash("sha256").update(String(s)).digest();
    return crypto.timingSafeEqual(digest(req.headers["x-gitlab-token"] || ""), digest(expected));
}

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
    }
    if (!fromGitLab(req)) {
        return res.status(401).send("Unauthorized");
    }

    const payload = req.body;

    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
        console.warn("⚠️ Missing BOT_TOKEN or CHAT_ID");
        return res.status(500).send("Missing env variables");
    }

    const escapeMDV2 = (text = "") =>
        text.replace(/([_\-*\[\]()~`>#+=|{}.!\\])/g, "\\$1");

    const convertJiraKeysToLinks = (text) => {
        return text.replace(/([A-Z]+-\d+)/g, (match) => {
            const url = `https://bsdesk.atlassian.net/browse/${match}`;
            return `[${match}](${url})`;
        });
    };

    // === ✅ 1. Catch successful final Deploy job ===
    const isFinalDeploy =
        payload?.object_kind === "build" &&
        payload?.build_name === "Deploy" &&
        payload?.build_stage === "Deploy" &&
        payload?.build_status === "success";

    // Only allow deploys from master to production-cloud
    const isDeployMasterToProduction =
        isFinalDeploy &&
        /Merge branch 'master' into 'production-cloud'*/.test(payload.commit?.message || "");

    if (isDeployMasterToProduction) {
        const projectName =
            payload.project_name || payload.project?.name || "Unknown Project";
        const fullProjectName = payload.project?.path_with_namespace || "";
        const branch = payload.ref?.split("/").pop();
        const committer =
            payload.commit?.author_name || payload.user?.name || "Unknown";
        const commitMsg =
            payload.commit?.message?.split("\n")[0] || "No commit message";
        const sha = payload.sha?.slice(0, 7);
        const duration = Math.round(payload.build_duration);
        const pipelineUrl = `${payload.project?.web_url}/-/pipelines/${payload.pipeline_id}`;

        let message = `🚀 *Deployment Finished*
📦 *Project:* ${escapeMDV2(projectName)}
🌿 *Branch:* \`${escapeMDV2(branch)}\`
🔢 *Commit:* \`${sha}\`
🧠 *By:* ${escapeMDV2(committer)}
📝 *Message:* ${escapeMDV2(commitMsg)}
⏱️ *Duration:* ${duration}s
🔗 [Open pipeline](${pipelineUrl})`;

        console.log("✅ Deployment message:", message);
        await sendToTelegram(message, BOT_TOKEN, CHAT_ID);
        return res.status(200).send("Deploy processed");
    }

    // === ✅ 2. Catch Merge Request (develop → master) ===
    const isMRMergeSpecial =
        payload?.object_kind === "merge_request" &&
        payload?.object_attributes?.state === "merged" &&
        payload?.project?.path_with_namespace ===
            "boosteroid-web/boosteroid-webclient" &&
        [
            ["develop", "master"],
        ].some(
            ([from, to]) =>
                payload.object_attributes.source_branch === from &&
                payload.object_attributes.target_branch === to
        );

    if (isMRMergeSpecial) {
        const mrTitle = payload.object_attributes.title;
        const mrAuthor = payload.user?.name;
        const project = payload.project.name;
        const url = payload.object_attributes.url;
        const rawDescription = payload.object_attributes.description || "";
        const match = url.match(/merge_requests\/(\d+)/);
        const mrNumber = escapeMDV2(match ? "#" + match[1] : "Unknown");

        const hyperlink = `🔗 [View MR ${mrNumber}](${url})`;

        let parsedChangelog = rawDescription
            .split("\n")
            .filter(line => line.trim().startsWith("-"))
            .map(line => {
                // Remove '-'
                let content = line.trim().substring(1).trim();
                // Replace Jira keys with MarkdownV2 links (escape only the key)
                content = content.replace(/([A-Z]+-\d+)/gi, match => {
                    const url = `https://bsdesk.atlassian.net/browse/${match}`;
                    return `[${escapeMDV2(match)}](${url})`;
                });
                // Escape the rest of the line, except for links
                // To keep it simple, we assume only one Jira key per line (common case)
                // If there is a link, split and escape only non-link parts
                const linkMatch = content.match(/\[.+?\]\(.+?\)/);
                if (linkMatch) {
                    const [before, after] = content.split(linkMatch[0]);
                    return `• ${escapeMDV2(before)}${linkMatch[0]}${escapeMDV2(after)}`;
                } else {
                    return `• ${escapeMDV2(content)}`;
                }
            })
            .join("\n");

        // parsedChangelog = convertJiraKeysToLinks(parsedChangelog);
        // parsedChangelog = escapeMDV2(parsedChangelog);

        let msg = `📦 *Project:* ${escapeMDV2(project)}
🔀 *Merged:* \`${escapeMDV2(
            payload.object_attributes.source_branch
        )}\` → \`${escapeMDV2(payload.object_attributes.target_branch)}\`
🧠 *By:* ${escapeMDV2(mrAuthor)}
📝 *Title:* ${escapeMDV2(mrTitle)}
${hyperlink}`;

        if (parsedChangelog) {
            msg += `

🧾 *Changelog:*\n${parsedChangelog}`;
        }

        msg += `
        
${escapeMDV2("#deploy_master")}  \n👥 @Gefest3D @dee3xy @dmtrbk @OstretsovIvan`;

        console.log("✅ Merge request message:", msg);
        await sendToTelegram(msg, BOT_TOKEN, CHAT_ID);
        return res.status(200).send("Merge processed");
    }

    return res.status(200).send("Ignored");
};

// --- Telegram helper ---
async function sendToTelegram(text, token, chatId) {
    try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text,
            parse_mode: "MarkdownV2",
            disable_web_page_preview: true,
        });
    } catch (err) {
        console.error(
            "❌ Telegram send error:",
            err.response?.data || err.message
        );
    }
}
