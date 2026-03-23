"""
utils.py
--------
Stateless helper utilities: export (CSV / JSON) and small formatting
functions.  No Streamlit, no I/O side-effects beyond returning strings.
"""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import Any


# ---------------------------------------------------------------------------
# Export helpers
# ---------------------------------------------------------------------------

def export_to_csv(analytics: dict[str, Any], chat_name: str) -> str:
    """
    Serialize *analytics* to a UTF-8 CSV string.
    The file contains a per-user summary table followed by totals.
    """
    buf = io.StringIO()
    writer = csv.writer(buf)

    writer.writerow(["Chat", chat_name])
    writer.writerow(["Exported at", datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
    writer.writerow([])

    # Header
    writer.writerow([
        "User",
        "Reels Sent",
        "Replies Received",
        "Reactions Received",
        "Reply Rate (%)",
    ])

    all_users: set[str] = set()
    all_users.update(analytics.get("reels_sent", {}).keys())
    all_users.update(analytics.get("replies_received", {}).keys())
    all_users.update(analytics.get("reaction_totals", {}).keys())

    for user in sorted(all_users):
        writer.writerow([
            user,
            analytics["reels_sent"].get(user, 0),
            analytics["replies_received"].get(user, 0),
            analytics["reaction_totals"].get(user, 0),
            analytics["reply_rate"].get(user, 0.0),
        ])

    writer.writerow([])
    writer.writerow(["Total Reels", analytics.get("total_reels", 0)])
    writer.writerow(["Total Replies", analytics.get("total_replies", 0)])
    writer.writerow(["Total Reactions", analytics.get("total_reactions", 0)])
    writer.writerow(["Engagement Score", analytics.get("engagement_score", 0.0)])
    writer.writerow(["Most Active User", analytics.get("most_active_user", "—")])

    return buf.getvalue()


def export_to_json(analytics: dict[str, Any], chat_name: str) -> str:
    """Serialize *analytics* to a pretty-printed JSON string."""
    payload = {
        "chat_name": chat_name,
        "exported_at": datetime.now().isoformat(),
        "analytics": analytics,
    }
    return json.dumps(payload, indent=2, default=str)


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

def fmt_rate(rate: float) -> str:
    return f"{rate:.1f}%"


def fmt_score(score: float) -> str:
    return f"{score:.1f} / 100"


def top_user(metric_dict: dict[str, int]) -> tuple[str, int] | None:
    """Return (user, value) for the highest-count entry, or None if empty."""
    if not metric_dict:
        return None
    user = max(metric_dict, key=metric_dict.__getitem__)
    return user, metric_dict[user]


def build_summary_rows(
    all_analytics: dict[str, dict[str, Any]]
) -> list[dict[str, Any]]:
    """
    Flatten all-chats analytics into a list of summary dicts suitable for
    pandas / CSV display.
    """
    rows = []
    for chat_name, stats in all_analytics.items():
        rows.append({
            "Chat": chat_name,
            "Total Reels": stats.get("total_reels", 0),
            "Total Replies": stats.get("total_replies", 0),
            "Total Reactions": stats.get("total_reactions", 0),
            "Engagement Score": stats.get("engagement_score", 0.0),
            "Participants": len(stats.get("participants", [])),
            "Most Active User": stats.get("most_active_user") or "—",
        })
    rows.sort(key=lambda r: r["Total Reels"], reverse=True)
    return rows
