# IG Reel Analytics

A local, privacy-first Streamlit tool that parses your **Instagram data export** and surfaces reel engagement metrics across all your conversations.

---

## Features

- Upload the ZIP directly from Instagram's *Download your information* page
- Supports **JSON** format (primary) and **HTML** format (fallback)
- Per-chat metrics:
  - Reels sent per user
  - Replies received on reels (within 24 h window)
  - Reactions on reels
  - Reply Rate (%)
  - Weighted Engagement Score
- Interactive Plotly charts
- Export results as **CSV** or **JSON**
- 100 % local — no data leaves your device

---

## Quick Start

```bash
# 1 – create a virtual environment (recommended)
python3 -m venv .venv
source .venv/bin/activate

# 2 – install dependencies
pip install -r requirements.txt

# 3 – launch the app
streamlit run app.py
```

The app opens at `http://localhost:8501` in your browser.

---

## Deployment

This project is deployment-ready with:

- `Dockerfile`
- `.streamlit/config.toml`
- `railway.toml`
- `render.yaml`

### Railway

```bash
cd ig-reel-analytics
railway login
railway init
railway up
```

### Render

1. Push this repo to GitHub
2. In Render, create a new **Blueprint** service from this repo
3. Render will auto-detect `render.yaml` and deploy the app

### Streamlit Community Cloud

1. Push this repo to GitHub
2. In Streamlit Cloud, create app from:
  - Repository: `satyam-nyk/satyamnyk-site`
  - App file path: `ig-reel-analytics/app.py`

---

## Project Structure

```
ig-reel-analytics/
├── app.py               ← Streamlit UI entry-point
├── parser_json.py       ← Parses message_N.json files
├── parser_html.py       ← Parses message_N.html files (BeautifulSoup)
├── parser_unified.py    ← ZIP extraction + format dispatch
├── analytics.py         ← Pure analytics engine
├── utils.py             ← Export (CSV/JSON) + formatting helpers
├── requirements.txt
├── extension_plan.md    ← Chrome Extension roadmap
└── README.md
```

---

## Input Format

Instagram exports a ZIP with this structure:

```
messages/
  inbox/
    {chat_folder}/
      message_1.json    ← JSON preferred
      message_1.html    ← HTML fallback
      message_2.json    ← additional pages if chat is large
```

Both **JSON** and **HTML** formats are supported.

---

## Analytics Explained

| Metric | How it is computed |
|---|---|
| **Reels Sent** | Count of messages where `share.link` (JSON) or `<a href>` (HTML) contains `/reel/` |
| **Replies Received** | For each reel, count whether the next message from a *different* user arrived within 24 h |
| **Reactions** | Counted from the `reactions` array (JSON) or emoji spans near the message (HTML) |
| **Reply Rate** | `(replies_received / reels_sent) × 100` |
| **Engagement Score** | `min((reply_rate × 0.60 + reaction_rate × 0.40) × 100, 100)` |

---

## Chrome Extension

See [extension_plan.md](extension_plan.md) for the roadmap to port this
tool into a browser extension that reads Instagram's live DOM.
