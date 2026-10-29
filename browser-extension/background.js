/*
 * YouTube Rich Presence — background service worker
 * Receives track data from content script and POSTs to Render webhook.
 * Settings are stored in chrome.storage and synced with the bot via webhook.
 */

(function () {
    "use strict";

    const POLL_MS = 3000; // how often to push presence updates to bot

    let config = {
        service: "youtube",
        type: "PLAYING",
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

    let currentTrack = null;
    let webhookUrl = "";

    // Load settings from storage
    chrome.storage.sync.get(
        {
            webhookUrl: "",
            service: "youtube",
            type: "PLAYING",
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
            excludeKeywords: "",
            includeKeywords: "",
        },
        (items) => {
            webhookUrl = items.webhookUrl || "";
            config = {
                service: items.service || "youtube",
                type: items.type || "PLAYING",
                status: items.status || "online",
                name: items.name || "YouTube",
                details: items.details || "Watching videos",
                state: items.state || "YouTube",
                url: items.url || "https://youtube.com",
                addByBeforeAuthor: items.addByBeforeAuthor !== false,
                useThumbnail: items.useThumbnail !== false,
                thumbnailUrl: items.thumbnailUrl || "https://www.youtube.com/img/desktop/yt_400.png",
                showVideoButton: items.showVideoButton !== false,
                showChannelButton: items.showChannelButton === true,
                channelUrl: items.channelUrl || "https://youtube.com",
                excludeKeywords: parseList(items.excludeKeywords),
                includeKeywords: parseList(items.includeKeywords),
            };
            console.log("[YouTubeRPC] settings loaded", config);
        }
    );

    function parseList(value) {
        if (!value) return [];
        return value.split(",").map((x) => x.trim()).filter(Boolean);
    }

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg && msg.type === "youtube-track") {
            currentTrack = msg.track;
        }
        sendResponse({ ok: true });
    });

    function pushToBot() {
        if (!webhookUrl || !currentTrack) return;

        const service = currentTrack.service === "youtubemusic" ? "youtubemusic" : "youtube";

        // Apply extension-level service toggle
        if (service === "youtube" && config.service !== "youtube" && config.service !== "both") return;
        if (service === "youtubemusic" && config.service !== "youtubemusic" && config.service !== "both") return;

        const payload = {
            config,
            track: {
                service: currentTrack.service,
                title: currentTrack.title,
                channel: currentTrack.channel,
                channelUrl: currentTrack.channelUrl,
                url: currentTrack.url,
                thumbnail: currentTrack.thumbnail,
                duration: currentTrack.duration,
                currentTime: currentTrack.currentTime,
                playing: currentTrack.playing,
            },
        };

        fetch(webhookUrl + "/webhook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }).catch(() => {
            // silently ignore — bot may be down
        });
    }

    setInterval(pushToBot, POLL_MS);

    // Listen for settings changes from options page
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.webhookUrl) webhookUrl = changes.webhookUrl.newValue || "";
        if (changes.service) config.service = changes.service.newValue;
        if (changes.type) config.type = changes.type.newValue;
        if (changes.status) config.status = changes.status.newValue;
        if (changes.name) config.name = changes.name.newValue;
        if (changes.details) config.details = changes.details.newValue;
        if (changes.state) config.state = changes.state.newValue;
        if (changes.url) config.url = changes.url.newValue;
        if (changes.addByBeforeAuthor !== undefined) config.addByBeforeAuthor = changes.addByBeforeAuthor.newValue;
        if (changes.useThumbnail !== undefined) config.useThumbnail = changes.useThumbnail.newValue;
        if (changes.thumbnailUrl) config.thumbnailUrl = changes.thumbnailUrl.newValue;
        if (changes.showVideoButton !== undefined) config.showVideoButton = changes.showVideoButton.newValue;
        if (changes.showChannelButton !== undefined) config.showChannelButton = changes.showChannelButton.newValue;
        if (changes.channelUrl) config.channelUrl = changes.channelUrl.newValue;
        if (changes.excludeKeywords) config.excludeKeywords = parseList(changes.excludeKeywords.newValue);
        if (changes.includeKeywords) config.includeKeywords = parseList(changes.includeKeywords.newValue);
    });
})();
