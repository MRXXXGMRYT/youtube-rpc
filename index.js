/*
 * YouTube Rich Presence — Discord SELF-BOT (discord.js v14)
 * Receives track data from browser extension via webhook and sets presence.
 *
 * WARNING: Self-bot using user token violates Discord ToS. Use a throwaway account.
 */

require("dotenv").config();

const { Client, GatewayIntentBits, ActivityType } = require("discord.js");
const express = require("express");

/* ------------------------------------------------------------------ */
/* Config                                                             */
/* ------------------------------------------------------------------ */

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN || TOKEN === "your_user_token_here") {
    console.error("FATAL: Set DISCORD_TOKEN in .env (your Discord user token)");
    process.exit(1);
}

// Defaults — extension can override via webhook payload
let config = {
    service: "youtube",        // youtube | youtubemusic
    type: "PLAYING",           // PLAYING | LISTENING | STREAMING | COMPETING | WATCHING
    status: "online",
    name: "YouTube",
    details: "Watching videos",
    state: "YouTube",
    url: "https://youtube.com",
    addByBeforeAuthor: true,
    useThumbnail: true,
    thumbnailUrl: "https://www.youtube.com/img/desktop/yt_400.png",
    showVideoButton: true,
    showChannelButton: false,
    channelUrl: "https://youtube.com",
    excludeKeywords: [],
    includeKeywords: [],
};

/* ------------------------------------------------------------------ */
/* Incoming track from extension                                      */
/* ------------------------------------------------------------------ */

let currentTrack = null; // { service, title, channel, thumbnail, duration, currentTime, playing, url, channelUrl }

function parseList(value) {
    if (!value) return [];
    return value.split(",").map((x) => x.trim()).filter(Boolean);
}

function textContains(text, keyword) {
    if (!text) return false;
    return text.toLowerCase().includes(keyword.toLowerCase());
}

function matchesAny(text, list) {
    return list.some((item) => textContains(text, item));
}

function shouldShow(track) {
    const haystack = `${track.title || ""} ${track.channel || ""}`.toLowerCase();

    if (config.excludeKeywords.length > 0) {
        for (const kw of config.excludeKeywords) {
            if (textContains(haystack, kw)) return false;
        }
    }

    if (config.includeKeywords.length > 0) {
        let included = false;
        for (const kw of config.includeKeywords) {
            if (textContains(haystack, kw)) {
                included = true;
                break;
            }
        }
        if (!included) return false;
    }

    return true;
}

/* ------------------------------------------------------------------ */
/* Activity builder                                                   */
/* ------------------------------------------------------------------ */

function buildActivity(track) {
    const serviceName = track.service === "youtubemusic" ? "YouTube Music" : "YouTube";
    const name = `${serviceName} - ${track.title || config.name}`;
    const state = config.addByBeforeAuthor ? `by ${track.channel || config.state}` : (track.channel || config.state);

    const activity = {
        name,
        type: ActivityType[config.type] || ActivityType.Playing,
        url: config.type === "STREAMING" ? config.url : undefined,
        details: track.title || config.details,
        state,
    };

    // Large image = thumbnail
    if (config.useThumbnail && track.thumbnail) {
        activity.assets = {
            largeImage: track.thumbnail,
            largeText: track.title || config.name,
        };
    }

    // Timestamps — Discord music progress bar
    if (
        track.playing &&
        track.currentTime != null &&
        track.duration &&
        track.duration > 0
    ) {
        const started = Date.now() - track.currentTime * 1000;
        activity.timestamps = {
            start: started,
            end: started + track.duration * 1000,
        };
    }

    // Buttons
    const buttons = [];
    if (config.showVideoButton && track.url) {
        buttons.push({ label: "Watch on YouTube", url: track.url });
    }
    if (config.showChannelButton && track.channelUrl) {
        buttons.push({ label: "Channel", url: track.channelUrl });
    }
    if (buttons.length > 0) {
        activity.buttons = buttons;
    }

    return activity;
}

/* ------------------------------------------------------------------ */
/* Express                                                            */
/* ------------------------------------------------------------------ */

const app = express();
app.use(express.json({ limit: "100kb" }));

// Extension posts track data here
app.post("/webhook", (req, res) => {
    const payload = req.body;

    // Allow extension to push config updates too
    if (payload.config) {
        config = { ...config, ...payload.config };
        console.log("[Config] updated from extension");
    }

    currentTrack = payload.track || null;
    console.log(`[Webhook] track: ${currentTrack ? currentTrack.title : "null"} (${currentTrack ? currentTrack.service : "-"})`);
    res.status(200).send("ok");
});

app.get("/", (req, res) => {
    res.send("YouTube Rich Presence self-bot is running.");
});

app.get("/healthz", (req, res) => {
    res.status(200).send("ok");
});

const HTTP_PORT = process.env.PORT || 10000;
app.listen(HTTP_PORT, () => {
    console.log(`[HTTP] keep-alive on port ${HTTP_PORT}`);
});

/* ------------------------------------------------------------------ */
/* Discord self-bot                                                   */
/* ------------------------------------------------------------------ */

const client = new Client({
    intents: [],
    makeCache: { MessageManager: () => null },
});

let presenceInterval = null;

client.once("ready", () => {
    console.log(`[Discord] Logged in as ${client.user.tag} (${client.user.id})`);
    console.warn("[Discord] SELF-BOT — may violate Discord ToS. Use a throwaway account.");

    function updatePresence() {
        if (!currentTrack || !shouldShow(currentTrack)) {
            client.user.setPresence({ activities: [], status: config.status });
            return;
        }

        client.user.setPresence({
            activities: [buildActivity(currentTrack)],
            status: config.status,
        });
    }

    updatePresence();
    presenceInterval = setInterval(updatePresence, 5000);
});

client.on("error", (err) => console.error("[Discord]", err));
client.on("warn", (w) => console.warn("[Discord]", w));

client.login(TOKEN).catch((err) => {
    console.error("[Discord] Login failed:", err.message);
    process.exit(1);
});

process.on("SIGINT", () => {
    if (presenceInterval) clearInterval(presenceInterval);
    client.destroy();
    process.exit(0);
});

process.on("SIGTERM", () => {
    if (presenceInterval) clearInterval(presenceInterval);
    client.destroy();
    process.exit(0);
});
