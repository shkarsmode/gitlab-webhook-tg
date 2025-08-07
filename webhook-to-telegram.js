// npm install express axios
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// const BOT_TOKEN = process.env.BOT_TOKEN;
// const CHAT_ID = process.env.CHAT_ID;

app.post("/gitlab-webhook", async (req, res) => {
    const payload = req.body;

    const branch = payload.ref?.split("/")?.pop();
    const project = payload.project?.name;
    const username = payload.user_name;

    const text = `🚀 *Деплой выполнен!*
📦 Проект: *${project}*
🔀 Ветка: *${branch}*
👤 От: *${username}*`;

console.log(req);
console.log(req.body);
console.log(text);

    // try {
    //     await axios.post(
    //         `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    //         {
    //             chat_id: CHAT_ID,
    //             text,
    //             parse_mode: "Markdown",
    //         }
    //     );

    //     res.sendStatus(200);
    // } catch (err) {
    //     console.error("Ошибка при отправке в Telegram:", err.message);
    //     res.sendStatus(500);
    // }
});

app.get("/test", (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Hello</title></head><body><h1>Hello, World!</h1></body></html>`);
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
    console.log(`🚀 Webhook proxy listening on port ${PORT}`)
);
