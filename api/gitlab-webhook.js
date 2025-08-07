const axios = require("axios");

// --- Main handler ---
module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
    }

    const payload = req.body;
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
        console.warn("⚠️ Missing BOT_TOKEN or CHAT_ID");
        return res.status(500).send("Missing env variables");
    }

    // === ✅ 1. Successful Deploy job ===
    const isFinalDeploy =
        payload?.object_kind === "build" &&
        payload?.build_name === "Deploy" &&
        payload?.build_stage === "Deploy" &&
        payload?.build_status === "success";

    if (isFinalDeploy) {
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
📦 *Project:* ${escapeMD(projectName)}
🌿 *Branch:* \`${branch}\`
🔢 *Commit:* \`${sha}\`
🧠 *By:* ${escapeMD(committer)}
📝 *Message:* ${escapeMD(commitMsg)}
⏱️ *Duration:* ${duration}s
🔗 [Open pipeline](${pipelineUrl})`;

        const isDeployToMaster =
            fullProjectName === "boosteroid-web/boosteroid-webclient" &&
            /Merge branch 'develop' into 'master'/.test(
                payload.commit?.message || ""
            );

        if (isDeployToMaster) {
            message += `

#deploy_master  
👥 @Gefest3D @dee3xy @dmtrbk @OstretsovIvan`;
        }

        console.log("✅ Deployment message:", message);
        await sendToTelegram(message, BOT_TOKEN, CHAT_ID);
        return res.status(200).send("Deploy processed");
    }

    // === ✅ 2. Merge MR: develop → master or master → staging-cloud ===
    const isMRMergeToMasterOrStaging =
        payload?.object_kind === "merge_request" &&
        payload?.object_attributes?.state === "merged" &&
        payload?.project?.path_with_namespace ===
            "boosteroid-web/boosteroid-webclient" &&
        ((payload?.object_attributes?.source_branch === "develop" &&
            payload?.object_attributes?.target_branch === "master") ||
            (payload?.object_attributes?.source_branch === "master" &&
                payload?.object_attributes?.target_branch === "staging-cloud"));

    if (isMRMergeToMasterOrStaging) {
        const mrTitle = payload.object_attributes.title;
        const mrAuthor = payload.user?.name;
        const project = payload.project.name;
        const url = payload.object_attributes.url;
        const rawDescription = payload.object_attributes.description || "";

        const fromBranch = payload.object_attributes.source_branch;
        const toBranch = payload.object_attributes.target_branch;

        const parsedChangelog = rawDescription
            .split("\n")
            .filter((line) => line.trim().startsWith("-"))
            .map((line) => `• ${escapeMD(line.trim().substring(1).trim())}`)
            .join("\n");

        let msg = `📦 *Project:* ${escapeMD(project)}
🔀 *Merged:* \`${fromBranch}\` → \`${toBranch}\`
🧠 *By:* ${escapeMD(mrAuthor)}
📝 *Title:* ${escapeMD(mrTitle)}
🔗 [View MR](${url})`;

        if (parsedChangelog) {
            msg += `

🧾 *Changelog:*
${parsedChangelog}`;
        }

        msg += `

#deploy_master  
👥 @Gefest3D @dee3xy @dmtrbk @OstretsovIvan`;

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
            parse_mode: "Markdown",
            disable_web_page_preview: true,
        });
    } catch (err) {
        console.error(
            "❌ Telegram send error:",
            err.response?.data || err.message
        );
    }
}

// --- Markdown escaper ---
function escapeMD(text = "") {
    return text
        .replace(/_/g, "\\_")
        .replace(/\*/g, "\\*")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")
        .replace(/~/g, "\\~")
        .replace(/`/g, "\\`")
        .replace(/>/g, "\\>")
        .replace(/#/g, "\\#")
        .replace(/\+/g, "\\+")
        .replace(/-/g, "\\-")
        .replace(/=/g, "\\=")
        .replace(/\|/g, "\\|")
        .replace(/{/g, "\\{")
        .replace(/}/g, "\\}")
        .replace(/\./g, "\\.")
        .replace(/!/g, "\\!");
}
