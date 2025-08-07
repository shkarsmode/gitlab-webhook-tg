const axios = require("axios");

module.exports = async (req, res) => {
    if (req.method === "GET") {
        res.setHeader("Content-Type", "text/html");
        return res.status(200).send(`<!DOCTYPE html><html><head><title>Hello</title></head><body><h1>Hello, World!</h1></body></html>`);
    }
    if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
    }

    // const BOT_TOKEN = process.env.BOT_TOKEN;
    // const CHAT_ID = process.env.CHAT_ID;

    const payload = req.body;

    const branch = payload.ref?.split("/")?.pop();
    const project = payload.project?.name;
    const username = payload.user_name;

    const text = `🚀 *Деплой выполнен!*
📦 Проект: *${project}*
🔀 Ветка: *${branch}*
👤 От: *${username}*`;

console.log(text);
console.log(payload);

    // try {
    //     await axios.post(
    //         `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    //         {
    //             chat_id: CHAT_ID,
    //             text,
    //             parse_mode: "Markdown",
    //         }
    //     );

    //     res.status(200).send("Message sent");
    // } catch (error) {
    //     console.error(error);
    //     res.status(500).send("Failed to send message");
    // }
};
