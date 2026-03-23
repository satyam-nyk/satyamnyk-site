# Chrome Extension Roadmap — IG Reel Analytics

This document outlines how the **IG Reel Analytics** Python/Streamlit tool
can be ported into a Chrome Extension that reads Instagram's live DOMdirectly — no export step required.

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Chrome Extension                           │
│                                             │
│  manifest.json           configuration      │
│  content_script.js  ←──  reads IG DOM       │
│  analytics_js.js    ←──  pure JS analytics  │
│  popup.html / popup.js   results UI         │
│  background.js           lifecycle mgmt     │
└─────────────────────────────────────────────┘
```

---

## Phase 1 – Content Script DOM Reader (`content_script.js`)

The content script runs in the context of `https://www.instagram.com/direct/*`
(DM thread pages).

### What to extract

```js
// Unified message object (mirrors Python schema)
{
  sender_name: string,
  timestamp:   number,      // Unix ms
  is_reel:     boolean,
  reel_link:   string|null,
  reactions:   Array<{ actor: string, reaction: string }>
}
```

### Sender detection

Instagram DM threads render each message bubble inside a container `<div>`
that has an adjacent element showing the sender's username or avatar alt-text:

```js
// Example selector – adjust to current Instagram DOM
const msgBubbles = document.querySelectorAll('[data-testid="message-bubble"]');

msgBubbles.forEach(bubble => {
  const senderEl = bubble.closest('[role="row"]')
                         ?.querySelector('[data-testid="message-author"]');
  const sender = senderEl?.textContent?.trim() ?? "Unknown";
  // ...
});
```

Because Instagram's class names are obfuscated and change frequently,
**prefer `data-testid`, `aria-label`, and `role` attributes** over class selectors.

### Reel link detection

```js
function isReelLink(url) {
  return typeof url === "string" && url.includes("/reel/");
}

const links = bubble.querySelectorAll("a[href]");
const reelLink = [...links].find(a => isReelLink(a.href))?.href ?? null;
const isReel   = reelLink !== null;
```

### Reaction extraction

```js
// Reactions often appear as <span> inside a reaction-row element
const reactionRow = bubble.querySelector('[aria-label*="reaction"]');
const reactions   = [];
reactionRow?.querySelectorAll("span").forEach(span => {
  const emoji = span.textContent.trim();
  const actor = span.getAttribute("aria-label") ?? "";
  if (emoji) reactions.push({ actor, reaction: emoji });
});
```

### Timestamp

```js
const timeEl = bubble.querySelector("time");
const timestamp = timeEl ? new Date(timeEl.getAttribute("datetime")).getTime()
                         : Date.now();
```

---

## Phase 2 – Analytics Engine (`analytics_js.js`)

Port `analytics.py` to pure JavaScript.  Every function is a pure function
with no side effects — identical contract to the Python version.

```js
// analytics_js.js

const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 h

function computeAnalytics(messages) {
  const reelsSent        = {};
  const repliesReceived  = {};
  const reactionTotals   = {};

  for (const msg of messages) {
    if (!msg.is_reel) continue;
    const s = msg.sender_name;
    reelsSent[s] = (reelsSent[s] ?? 0) + 1;

    for (const rxn of msg.reactions ?? []) {
      reactionTotals[s] = (reactionTotals[s] ?? 0) + 1;
    }
  }

  // Reply counting
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg.is_reel) continue;
    for (let j = i + 1; j < messages.length; j++) {
      const next = messages[j];
      if (next.sender_name === msg.sender_name) continue;
      if (next.timestamp - msg.timestamp > REPLY_WINDOW_MS) break;
      repliesReceived[msg.sender_name] = (repliesReceived[msg.sender_name] ?? 0) + 1;
      break;
    }
  }

  const totalReels     = Object.values(reelsSent).reduce((a, b) => a + b, 0);
  const totalReplies   = Object.values(repliesReceived).reduce((a, b) => a + b, 0);
  const totalReactions = Object.values(reactionTotals).reduce((a, b) => a + b, 0);

  const replyRate = {};
  for (const [user, count] of Object.entries(reelsSent)) {
    replyRate[user] = count > 0
      ? ((repliesReceived[user] ?? 0) / count * 100).toFixed(1)
      : "0.0";
  }

  const engagementScore = engScore(totalReels, totalReplies, totalReactions);

  return { reelsSent, repliesReceived, reactionTotals, replyRate,
           totalReels, totalReplies, totalReactions, engagementScore };
}

function engScore(totalReels, totalReplies, totalReactions) {
  if (totalReels === 0) return 0;
  const rr = totalReplies  / totalReels;
  const xr = totalReactions / totalReels;
  return Math.min((rr * 0.60 + xr * 0.40) * 100, 100).toFixed(2);
}
```

---

## Phase 3 – Popup UI (`popup.html` + `popup.js`)

A simple HTML popup that:

1. Receives a `messages` array from the content script via `chrome.runtime.sendMessage`
2. Calls `computeAnalytics(messages)`
3. Renders a summary table + a Chart.js bar chart

```html
<!-- popup.html (skeleton) -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>IG Reel Analytics</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <h2>📊 IG Reel Analytics</h2>
  <div id="stats"></div>
  <canvas id="chart" width="360" height="200"></canvas>
  <script src="analytics_js.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

---

## Phase 4 – `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "IG Reel Analytics",
  "version": "1.0.0",
  "description": "Reel engagement analytics for Instagram DMs",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": ["https://www.instagram.com/*"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon128.png"
  },
  "content_scripts": [
    {
      "matches": ["https://www.instagram.com/direct/*"],
      "js": ["content_script.js"]
    }
  ],
  "background": {
    "service_worker": "background.js"
  }
}
```

---

## Key Parity Points (Python ↔ JavaScript)

| Python | JavaScript |
|---|---|
| `parser_json.py` → unified messages | `content_script.js` reads live DOM |
| `analytics.py` pure functions | `analytics_js.js` pure functions |
| `utils.py` `export_to_csv` | `popup.js` blob download |
| Streamlit UI | `popup.html` + Chart.js |

---

## Caveats & Risks

- Instagram's DOM structure changes frequently; selectors must be maintained.
- Instagram may block extensions that scrape DM content.
- Pagination: long threads require scrolling simulation or MutationObserver to capture all messages.
- The extension should never transmit any user data to external servers.

---

## Development Order

1. `manifest.json` + permissions
2. `content_script.js` — DOM reader + message posting
3. `analytics_js.js` — port analytics.py
4. `popup.html` / `popup.js` — results display
5. `background.js` — lifecycle + storage
6. Test on a real DM thread
7. Package and submit to Chrome Web Store
