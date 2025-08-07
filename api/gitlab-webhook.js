const axios = require("axios");

module.exports = async (req, res) => {
    if (req.method === "GET") {
        return res.status(200).send("✅ Webhook is alive.");
    }

    if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
    }

    const payload = req.body;

    const branch = payload.ref?.split("/")?.pop();
    const project = payload.project?.name;
    const username = payload.user_name;

    const text = `🚀 *Деплой выполнен!*
📦 Проект: *${project}*
🔀 Ветка: *${branch}*
👤 От: *${username}*`;

    console.log("🔥 Входящий payload:", payload);
    console.log("📨 Сообщение:", text);

    return res.status(200).send("Webhook received ✅");
};
