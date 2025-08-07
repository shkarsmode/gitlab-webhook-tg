const axios = require("axios");

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
    }

    const payload = req.body;

    // --- Filter: only successful "Deploy" jobs in "Deploy" stage ---
    const isFinalDeploy =
        payload?.object_kind === "build" &&
        payload?.build_name === "Deploy" &&
        payload?.build_stage === "Deploy" &&
        payload?.build_status === "success";

    if (!isFinalDeploy) {
        console.log("❌ Ignored non-deploy or failed job");
        return res.status(200).send("Not a final deploy");
    }

    // --- Extract data ---
    const projectName =
        payload.project_name || payload.project?.name || "Unknown Project";
    const branch = payload.ref?.split("/").pop();
    const committer =
        payload.commit?.author_name || payload.user?.name || "Unknown";
    const commitMsg =
        payload.commit?.message?.split("\n")[0] || "No commit message";
    const sha = payload.sha?.slice(0, 7);
    const duration = Math.round(payload.build_duration);
    const pipelineUrl = `${payload.project?.web_url}/-/pipelines/${payload.pipeline_id}`;

    // --- Telegram message ---
    const message = `🚀 *Deployment Finished*
📦 *Project:* ${projectName}
🌿 *Branch:* \`${branch}\`
🔢 *Commit:* \`${sha}\`
🧠 *By:* ${committer}
📝 *Message:* ${commitMsg}
⏱️ *Duration:* ${duration}s
🔗 [Open pipeline](${pipelineUrl})`;

    console.log("✅ Deployment completed:");
    console.log("Project:", projectName);
    console.log("Branch:", branch);
    console.log("Commit:", sha);
    console.log("User:", committer);
    console.log("Message:", commitMsg);
    console.log("Duration:", duration + "s");
    console.log("Link:", pipelineUrl);

    // --- Send to Telegram ---
    try {
        const BOT_TOKEN = process.env.BOT_TOKEN;
        const CHAT_ID = process.env.CHAT_ID;

        if (!BOT_TOKEN || !CHAT_ID) {
            console.warn("⚠️ BOT_TOKEN or CHAT_ID not set");
            return res.status(500).send("Missing Telegram credentials");
        }

        await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            {
                chat_id: CHAT_ID,
                text: message,
                parse_mode: "Markdown",
                disable_web_page_preview: true,
            }
        );

        return res.status(200).send("✅ Message sent");
    } catch (err) {
        console.error("❌ Failed to send Telegram message:", err.message);
        return res.status(500).send("Telegram error");
    }
};
