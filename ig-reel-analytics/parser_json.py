"""
parser_json.py
--------------
Parses Instagram data export JSON files (message_1.json, message_2.json, …)
and returns a list of unified message dicts.

Instagram JSON structure:
{
  "participants": [{"name": "..."}, ...],
  "messages": [
    {
      "sender_name": "...",
      "timestamp_ms": 1234567890000,
      "content": "...",           # optional
      "share": {"link": "..."},   # optional – present for shared reels/links
      "reactions": [              # optional
        {"reaction": "❤️", "actor": "..."}
      ]
    }
  ]
}
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_json_chat(folder_path: str) -> list[dict[str, Any]]:
    """Parse all message_N.json files inside *folder_path*, sorted by time."""
    all_messages: list[dict[str, Any]] = []
    index = 1
    while True:
        filepath = os.path.join(folder_path, f"message_{index}.json")
        if not os.path.exists(filepath):
            break
        all_messages.extend(_parse_json_file(filepath))
        index += 1

    all_messages.sort(key=lambda m: m["timestamp"])
    return all_messages


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_json_file(filepath: str) -> list[dict[str, Any]]:
    """Parse a single .json message file and return unified messages."""
    try:
        with open(filepath, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (json.JSONDecodeError, OSError):
        return []

    messages: list[dict[str, Any]] = []

    for raw in data.get("messages", []):
        sender = _decode_str(raw.get("sender_name", "Unknown"))

        ts_ms = raw.get("timestamp_ms", 0)
        timestamp = datetime.fromtimestamp(ts_ms / 1000) if ts_ms else datetime.now()

        content = _decode_str(raw.get("content", ""))

        share = raw.get("share", {})
        share_link: str = share.get("link", "") if isinstance(share, dict) else ""

        is_reel = _is_reel_link(share_link)
        reel_link: str | None = share_link if is_reel else None

        reactions: list[dict[str, str]] = [
            {
                "actor": _decode_str(r.get("actor", "")),
                "reaction": _decode_str(r.get("reaction", "")),
            }
            for r in raw.get("reactions", [])
            if isinstance(r, dict)
        ]

        messages.append(
            {
                "sender_name": sender,
                "timestamp": timestamp,
                "is_reel": is_reel,
                "reel_link": reel_link,
                "reactions": reactions,
                "content": content,
            }
        )

    return messages


def _decode_str(s: str) -> str:
    """
    Instagram sometimes double-encodes non-ASCII characters as latin-1 bytes.
    Try to round-trip through latin-1 → utf-8 to recover the original text.
    """
    if not s:
        return s
    try:
        return s.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s


def _is_reel_link(link: str) -> bool:
    return bool(link and "/reel/" in link)
