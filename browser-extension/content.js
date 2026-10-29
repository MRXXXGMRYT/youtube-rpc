/*
 * YouTube Rich Presence — content script
 * Reads YouTube/YouTube Music playback from the DOM and forwards to background.
 */

(function () {
    "use strict";

    const POLL_MS = 1000;

    function $text(sel) {
        const el = document.querySelector(sel);
        return el ? el.getAttribute("content") || el.textContent || "" : "";
    }

    function getTitle() {
        return (
            $text('meta[property="og:title"]') ||
            document.querySelector("h1")?.textContent ||
            ""
        );
    }

    function getChannel() {
        return (
            $text('meta[property="og:video:actor"]') ||
            document.querySelector("link[itemprop=author]")?.content ||
            document.querySelector("ytd-channel-name")?.textContent ||
            document.querySelector(".ytmusic-user-url")?.textContent ||
            ""
        );
    }

    function getChannelUrl() {
        const a = document.querySelector('link[itemprop=author]');
        if (a?.href) return a.href;
        const chan = document.querySelector("ytd-channel-name");
        if (chan) {
            const link = chan.querySelector("a");
            if (link?.href) return link.href;
        }
        const yt = document.querySelector(".ytmusic-user-url");
        if (yt?.href) return yt.href;
        return "";
    }

    function getThumbnail() {
        return (
            $text('meta[property="og:image"]') ||
            document.querySelector("link[rel=image_src]")?.href ||
            ""
        );
    }

    function getVideoId() {
        const m = window.location.href.match(/[?&]v=([^&#]+)/);
        return m ? m[1] : null;
    }

    function getService() {
        return window.location.hostname.includes("music.youtube.com") ? "youtubemusic" : "youtube";
    }

    function getUrl() {
        const id = getVideoId();
        return id ? `https://www.youtube.com/watch?v=${id}` : window.location.href;
    }

    function readPlayback() {
        const video = document.querySelector("video");
        if (!video) return null;
        return {
            currentTime: video.currentTime,
            duration: video.duration,
            playing: !video.paused && !video.ended && video.readyState > 2,
        };
    }

    function buildTrack() {
        const service = getService();
        const title = getTitle();
        const channel = getChannel();
        const channelUrl = getChannelUrl();
        const thumbnail = getThumbnail();
        const videoId = getVideoId();
        const url = getUrl();
        const playback = readPlayback();

        if (!title && !playback) return null;

        return {
            service,
            title,
            channel: channel || undefined,
            channelUrl: channelUrl || undefined,
            videoId: videoId || undefined,
            url,
            thumbnail: thumbnail || undefined,
            duration: playback && Number.isFinite(playback.duration) ? playback.duration : undefined,
            currentTime: playback && Number.isFinite(playback.currentTime) ? playback.currentTime : undefined,
            playing: playback ? playback.playing : false,
        };
    }

    let last = null;

    function tick() {
        const track = buildTrack();
        const changed = JSON.stringify(track) !== JSON.stringify(last);
        if (changed || (track && !last)) {
            last = track;
            chrome.runtime.sendMessage({ type: "youtube-track", track });
        }
    }

    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            last = null;
            tick();
        }
    }, 2000);

    tick();
    setInterval(tick, POLL_MS);
})();
