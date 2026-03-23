"""
app.py
------
Streamlit entry-point for IG Reel Analytics.

Run:
    streamlit run app.py
"""

from __future__ import annotations

import os
import tempfile
from typing import Any

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from analytics import compute_all_chats, find_most_active_chat
from parser_unified import parse_zip
from utils import (
    build_summary_rows,
    export_to_csv,
    export_to_json,
    fmt_rate,
    fmt_score,
    top_user,
)

# ─────────────────────────────────────────────
# Page config
# ─────────────────────────────────────────────
st.set_page_config(
    page_title="IG Reel Analytics",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─────────────────────────────────────────────
# CSS overrides
# ─────────────────────────────────────────────
st.markdown(
    """
<style>
/* gradient title */
h1 { background: linear-gradient(90deg,#833ab4,#fd1d1d,#fcb045);
     -webkit-background-clip:text; -webkit-text-fill-color:transparent;
     font-size:2.4rem !important; }

/* metric cards */
div[data-testid="stMetricValue"] { font-size:1.8rem; font-weight:700; }

/* dataframe */
div[data-testid="stDataFrame"] { border-radius:8px; overflow:hidden; }

/* file-uploader border */
div[data-testid="stFileUploader"] section {
    border:2px dashed #833ab4; border-radius:12px; }

/* sidebar */
section[data-testid="stSidebar"] { background:#0d0d0d; }
section[data-testid="stSidebar"] * { color:#eee; }
</style>
""",
    unsafe_allow_html=True,
)

# ─────────────────────────────────────────────
# Sidebar
# ─────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 📲 IG Reel Analytics")
    st.markdown(
        """
Export your Instagram data to get started:

1. Open **Instagram → Settings**
2. *Your activity → Download your information*
3. Select **Messages**, format **JSON** *(preferred)* or **HTML**
4. Download the ZIP and upload it below
"""
    )
    st.divider()
    st.caption("✅ Supports JSON & HTML export formats")
    st.caption("🔒 All processing happens locally — no data leaves your device")

# ─────────────────────────────────────────────
# Title
# ─────────────────────────────────────────────
st.title("📊 IG Reel Analytics")
st.markdown(
    "Upload your **Instagram data export** ZIP to see reel engagement stats "
    "across your conversations."
)

# ─────────────────────────────────────────────
# File upload
# ─────────────────────────────────────────────
uploaded_file = st.file_uploader(
    "📁 Upload Instagram Export ZIP",
    type=["zip"],
    help="The ZIP file downloaded from Instagram's 'Download your information' page.",
)

if not uploaded_file:
    st.info(
        "👆 Upload your Instagram export ZIP to begin.  "
        "Your data stays **100% local** — nothing is sent to any server."
    )
    with st.expander("ℹ️ What does this tool analyze?"):
        st.markdown(
            """
| Metric | Description |
|---|---|
| 🎬 Reels Sent | How many reels each participant shared in a chat |
| 💬 Replies | How many shared reels received a reply within 24 h |
| ❤️ Reactions | Total reactions left on reels per user |
| 📊 Reply Rate | Percentage of reels that got a reply |
| 🏆 Engagement Score | Weighted score (60 % replies + 40 % reactions) |
"""
        )
    st.stop()

# ─────────────────────────────────────────────
# Parse ZIP
# ─────────────────────────────────────────────
with st.spinner("🔍 Extracting and parsing your data…"):
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        tmp.write(uploaded_file.read())
        tmp_path = tmp.name

    try:
        all_chats: dict[str, list[dict[str, Any]]] = parse_zip(tmp_path)
    except Exception as exc:
        st.error(f"❌ Failed to parse the ZIP file: {exc}")
        os.unlink(tmp_path)
        st.stop()
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

if not all_chats:
    st.error(
        "❌ No chat data found.  "
        "Make sure the ZIP contains the `messages/inbox/` directory with "
        "`message_1.json` or `message_1.html` files."
    )
    st.stop()

# ─────────────────────────────────────────────
# Run analytics
# ─────────────────────────────────────────────
with st.spinner("⚙️ Computing analytics…"):
    all_analytics = compute_all_chats(all_chats)
    most_active_chat = find_most_active_chat(all_analytics)

# Filter to chats that actually have reel data
chats_with_reels = {
    name: stats
    for name, stats in all_analytics.items()
    if stats["total_reels"] > 0
}
chats_no_reels = len(all_analytics) - len(chats_with_reels)

st.success(
    f"✅ Parsed **{len(all_chats)} chat(s)** — "
    f"**{len(chats_with_reels)}** contain reel activity"
    + (f", {chats_no_reels} skipped (no reels)." if chats_no_reels else ".")
)

if not chats_with_reels:
    st.warning("No reels were detected in any chat.  Try exporting with JSON format.")
    st.stop()

# ─────────────────────────────────────────────
# Chat selector
# ─────────────────────────────────────────────
def _display_label(name: str, stats: dict[str, Any]) -> str:
    star = "⭐ " if name == most_active_chat else ""
    return f"{star}{name}  ({stats['total_reels']} reels)"

label_to_name = {
    _display_label(n, s): n for n, s in chats_with_reels.items()
}
labels = list(label_to_name.keys())

default_idx = 0
if most_active_chat and most_active_chat in chats_with_reels:
    default_label = _display_label(most_active_chat, chats_with_reels[most_active_chat])
    if default_label in labels:
        default_idx = labels.index(default_label)

selected_label = st.selectbox(
    "💬 Select Chat to Analyze",
    options=labels,
    index=default_idx,
)
selected_chat = label_to_name[selected_label]
stats = chats_with_reels[selected_chat]

# ─────────────────────────────────────────────
# ── Overview KPIs ────────────────────────────
# ─────────────────────────────────────────────
st.divider()
st.subheader(f"📈 Overview — {selected_chat}")

col1, col2, col3, col4, col5 = st.columns(5)
col1.metric("🎬 Total Reels", stats["total_reels"])
col2.metric("💬 Total Replies", stats["total_replies"])
col3.metric("❤️ Total Reactions", stats["total_reactions"])
col4.metric("📊 Engagement", fmt_score(stats["engagement_score"]))
col5.metric("👥 Participants", len(stats["participants"]))

if stats["most_active_user"]:
    st.info(f"⭐  Most active reel sender: **{stats['most_active_user']}**")

# ─────────────────────────────────────────────
# ── Per-User Table ───────────────────────────
# ─────────────────────────────────────────────
st.divider()
st.subheader("👤 Per-User Breakdown")

all_users: set[str] = set()
all_users.update(stats["reels_sent"].keys())
all_users.update(stats["replies_received"].keys())
all_users.update(stats["reaction_totals"].keys())

if all_users:
    rows = []
    for user in sorted(all_users):
        reels = stats["reels_sent"].get(user, 0)
        replies = stats["replies_received"].get(user, 0)
        reactions = stats["reaction_totals"].get(user, 0)
        rate = stats["reply_rate"].get(user, 0.0)
        rows.append(
            {
                "User": user,
                "Reels Sent": reels,
                "Replies Received": replies,
                "Reactions": reactions,
                "Reply Rate": fmt_rate(rate),
            }
        )
    df_users = pd.DataFrame(rows)
    st.dataframe(df_users, use_container_width=True, hide_index=True)

    # Reactions breakdown per user
    if stats["reactions_by_user"]:
        with st.expander("❤️  Reaction Details (who reacted to whose reels)"):
            for reel_sender, reactor_counts in stats["reactions_by_user"].items():
                if not reactor_counts:
                    continue
                st.markdown(f"**{reel_sender}'s reels:**")
                rxn_df = pd.DataFrame(
                    [{"Reactor": actor, "Count": cnt} for actor, cnt in reactor_counts.items()]
                ).sort_values("Count", ascending=False)
                st.dataframe(rxn_df, use_container_width=True, hide_index=True)

# ─────────────────────────────────────────────
# ── Charts ───────────────────────────────────
# ─────────────────────────────────────────────
st.divider()
st.subheader("📊 Charts")

_users_sorted = sorted(all_users)

col_l, col_r = st.columns(2)

with col_l:
    # Reels sent bar chart
    if stats["reels_sent"]:
        fig_reels = px.bar(
            x=list(stats["reels_sent"].keys()),
            y=list(stats["reels_sent"].values()),
            title="🎬 Reels Sent per User",
            labels={"x": "User", "y": "Reels Sent"},
            color=list(stats["reels_sent"].values()),
            color_continuous_scale="Purples",
            text_auto=True,
        )
        fig_reels.update_layout(
            showlegend=False,
            coloraxis_showscale=False,
            plot_bgcolor="rgba(0,0,0,0)",
        )
        st.plotly_chart(fig_reels, use_container_width=True)

with col_r:
    # Grouped engagement bar chart
    fig_eng = go.Figure()
    fig_eng.add_trace(
        go.Bar(
            name="Reels Sent",
            x=_users_sorted,
            y=[stats["reels_sent"].get(u, 0) for u in _users_sorted],
            marker_color="#833ab4",
            text=[stats["reels_sent"].get(u, 0) for u in _users_sorted],
            textposition="auto",
        )
    )
    fig_eng.add_trace(
        go.Bar(
            name="Replies Received",
            x=_users_sorted,
            y=[stats["replies_received"].get(u, 0) for u in _users_sorted],
            marker_color="#fd1d1d",
            text=[stats["replies_received"].get(u, 0) for u in _users_sorted],
            textposition="auto",
        )
    )
    fig_eng.add_trace(
        go.Bar(
            name="Reactions",
            x=_users_sorted,
            y=[stats["reaction_totals"].get(u, 0) for u in _users_sorted],
            marker_color="#fcb045",
            text=[stats["reaction_totals"].get(u, 0) for u in _users_sorted],
            textposition="auto",
        )
    )
    fig_eng.update_layout(
        title="📊 Engagement Comparison",
        barmode="group",
        xaxis_title="User",
        yaxis_title="Count",
        plot_bgcolor="rgba(0,0,0,0)",
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
    )
    st.plotly_chart(fig_eng, use_container_width=True)

# Reply rate gauge + reel share pie — second row
col_l2, col_r2 = st.columns(2)

with col_l2:
    # Reply-rate bar
    if stats["reply_rate"]:
        fig_rate = px.bar(
            x=list(stats["reply_rate"].keys()),
            y=list(stats["reply_rate"].values()),
            title="💬 Reply Rate per User (%)",
            labels={"x": "User", "y": "Reply Rate (%)"},
            color=list(stats["reply_rate"].values()),
            color_continuous_scale="RdYlGn",
            range_y=[0, 100],
            text_auto=".1f",
        )
        fig_rate.update_layout(
            showlegend=False,
            coloraxis_showscale=False,
            plot_bgcolor="rgba(0,0,0,0)",
        )
        st.plotly_chart(fig_rate, use_container_width=True)

with col_r2:
    # Reel share pie
    if stats["reels_sent"]:
        fig_pie = px.pie(
            names=list(stats["reels_sent"].keys()),
            values=list(stats["reels_sent"].values()),
            title="🎯 Reel Share by User",
            color_discrete_sequence=px.colors.sequential.RdPu,
            hole=0.3,
        )
        fig_pie.update_traces(textinfo="percent+label")
        st.plotly_chart(fig_pie, use_container_width=True)

# ─────────────────────────────────────────────
# ── Export ───────────────────────────────────
# ─────────────────────────────────────────────
st.divider()
st.subheader("📥 Export Insights")

col_csv, col_json = st.columns(2)

with col_csv:
    csv_str = export_to_csv(stats, selected_chat)
    st.download_button(
        label="⬇️  Download CSV",
        data=csv_str,
        file_name=f"reel_analytics_{selected_chat}.csv",
        mime="text/csv",
        use_container_width=True,
    )

with col_json:
    json_str = export_to_json(stats, selected_chat)
    st.download_button(
        label="⬇️  Download JSON",
        data=json_str,
        file_name=f"reel_analytics_{selected_chat}.json",
        mime="application/json",
        use_container_width=True,
    )

# ─────────────────────────────────────────────
# ── All Chats Summary ────────────────────────
# ─────────────────────────────────────────────
if len(chats_with_reels) > 1:
    st.divider()
    with st.expander(f"🗂️  All {len(chats_with_reels)} Chats Summary"):
        summary_rows = build_summary_rows(chats_with_reels)
        df_summary = pd.DataFrame(summary_rows)
        st.dataframe(df_summary, use_container_width=True, hide_index=True)

        # Export full summary
        summary_csv = export_to_csv(
            {
                "reels_sent": {r["Chat"]: r["Total Reels"] for r in summary_rows},
                "replies_received": {r["Chat"]: r["Total Replies"] for r in summary_rows},
                "reaction_totals": {r["Chat"]: r["Total Reactions"] for r in summary_rows},
                "reply_rate": {},
                "total_reels": sum(r["Total Reels"] for r in summary_rows),
                "total_replies": sum(r["Total Replies"] for r in summary_rows),
                "total_reactions": sum(r["Total Reactions"] for r in summary_rows),
                "engagement_score": 0.0,
                "most_active_user": most_active_chat,
            },
            "ALL_CHATS",
        )
        st.download_button(
            "⬇️  Export All Chats CSV",
            data=summary_csv,
            file_name="reel_analytics_all_chats.csv",
            mime="text/csv",
        )
