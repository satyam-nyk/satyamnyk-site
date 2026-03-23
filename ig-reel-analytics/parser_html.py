"""
parser_html.py
--------------
Parses Instagram data export HTML files (message_1.html, …) using
BeautifulSoup and returns a list of unified message dicts.

Instagram's HTML export wraps each message in a <div> block.  The exact
CSS classes change between export versions, so this parser uses multiple
detection strategies and falls back gracefully.

Install dependency:
    pip install beautifulsoup4
"""

from __future__ import annotations

import os
import re
import unicodedata
from datetime import datetime
from typing import Any

from bs4 import BeautifulSoup, Tag


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_html_chat(folder_path: str) -> list[dict[str, Any]]:
    """Parse all message_N.html files inside *folder_path*, sorted by time."""
    all_messages: list[dict[str, Any]] = []
    index = 1
    while True:
        filepath = os.path.join(folder_path, f"message_{index}.html")
        if not os.path.exists(filepath):
            break
        all_messages.extend(_parse_html_file(filepath))
        index += 1

    all_messages.sort(key=lambda m: m["timestamp"])
    return all_messages


# ---------------------------------------------------------------------------
# File-level parsing
# ---------------------------------------------------------------------------

def _parse_html_file(filepath: str) -> list[dict[str, Any]]:
    try:
        with open(filepath, "r", encoding="utf-8") as fh:
            raw = fh.read()
    except OSError:
        return []

    soup = BeautifulSoup(raw, "html.parser")
    blocks = _find_message_blocks(soup)
    messages: list[dict[str, Any]] = []

    for block in blocks:
        msg = _parse_message_block(block)
        if msg and msg["sender_name"]:
            messages.append(msg)

    return messages


# ---------------------------------------------------------------------------
# Block detection (multi-strategy)
# ---------------------------------------------------------------------------

# CSS class fragments that appear in Instagram message-block divs across
# different export generations.
_MSG_CLASS_PATTERNS = [
    re.compile(r"\bpam\b"),          # meta/instagram 2022-2024 exports
    re.compile(r"_a6-[a-z]"),        # class like _a6-g
    re.compile(r"\b_2ph-\b"),
    re.compile(r"message[-_]?block", re.I),
    re.compile(r"\bmsger\b", re.I),
]


def _find_message_blocks(soup: BeautifulSoup) -> list[Tag]:
    """Try several strategies to find per-message <div> elements."""
    blocks = soup.select("main[role='main'] > div._a6-g")
    if blocks:
        return blocks

    for pattern in _MSG_CLASS_PATTERNS:
        blocks = soup.find_all("div", class_=pattern)
        filtered = [block for block in blocks if _looks_like_message_block(block)]
        if filtered:
            return filtered

    # Strategy: role="row" tables
    blocks = soup.find_all("div", role="row")
    if blocks:
        return blocks

    # Strategy: divs that directly contain a <strong> and an <a> or <p> —
    # a good proxy for "message block with sender and content".
    candidates: list[Tag] = []
    for div in soup.find_all("div"):
        if _looks_like_message_block(div):
            candidates.append(div)
    if candidates:
        return candidates

    return []


# ---------------------------------------------------------------------------
# Per-block parsing
# ---------------------------------------------------------------------------

def _parse_message_block(div: Tag) -> dict[str, Any] | None:
    try:
        sender = _extract_sender(div)
        timestamp = _extract_timestamp(div)
        reel_link = _extract_reel_link(div)
        is_reel = reel_link is not None
        reactions = _extract_reactions(div)
        content = _extract_content(div)
        reaction_event = _extract_reaction_event(sender, content)

        return {
            "sender_name": sender,
            "timestamp": timestamp,
            "is_reel": is_reel,
            "reel_link": reel_link,
            "reactions": reactions,
            "content": content,
            "reaction_event": reaction_event,
        }
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Sender extraction
# ---------------------------------------------------------------------------

def _extract_sender(div: Tag) -> str:
    """Return sender name from the message block, or empty string."""
    # 1. Bold / strong are the most reliable indicators
    for tag in div.find_all(["strong", "b"]):
        text = tag.get_text(strip=True)
        if text and 1 < len(text) < 120:
            return _decode_str(text)

    # 2. Heading tags
    for tag in div.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
        text = tag.get_text(strip=True)
        if text and 1 < len(text) < 120:
            return _decode_str(text)

    # 3. <span> with classes that look like sender/author/name labels
    _author_class_re = re.compile(r"(_2pim|sender|author|name|_3-95)", re.I)
    for span in div.find_all("span", class_=_author_class_re):
        text = span.get_text(strip=True)
        if text and 1 < len(text) < 120:
            return _decode_str(text)

    return ""


# ---------------------------------------------------------------------------
# Timestamp extraction
# ---------------------------------------------------------------------------

# Ordered from most-specific to least-specific
_TS_PATTERNS: list[tuple[str, str]] = [
    # "Jan 1, 2023, 12:00 AM"  (Meta export default)
    (r"(\b\w{3}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s+[APap][Mm]\b)", "%b %d, %Y, %I:%M %p"),
    # "Jan 1, 2023 12:00 AM"
    (r"(\b\w{3}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s+[APap][Mm]\b)", "%b %d, %Y %I:%M %p"),
    # "2023-01-01 12:00:00"
    (r"(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})", "%Y-%m-%d %H:%M:%S"),
    # "2023-01-01T12:00:00"
    (r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})", "%Y-%m-%dT%H:%M:%S"),
    # "01/01/2023, 12:00"
    (r"(\d{2}/\d{2}/\d{4},\s*\d{2}:\d{2})", "%d/%m/%Y, %H:%M"),
    # "01/01/2023 12:00"
    (r"(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2})", "%d/%m/%Y %H:%M"),
]


def _extract_timestamp(div: Tag) -> datetime:
    text = div.get_text(separator=" ")
    for pattern, fmt in _TS_PATTERNS:
        match = re.search(pattern, text)
        if match:
            try:
                raw_value = match.group(1).strip()
                normalized = re.sub(r"\b(am|pm)\b", lambda m: m.group(1).upper(), raw_value)
                return datetime.strptime(normalized, fmt)
            except ValueError:
                continue
    return datetime.fromtimestamp(0)  # epoch sentinel when not found


# ---------------------------------------------------------------------------
# Reel link extraction
# ---------------------------------------------------------------------------

def _extract_reel_link(div: Tag) -> str | None:
    for a_tag in div.find_all("a", href=True):
        href: str = a_tag["href"]
        if "/reel/" in href:
            return href
    return None


# ---------------------------------------------------------------------------
# Reaction extraction
# ---------------------------------------------------------------------------

def _extract_reactions(div: Tag) -> list[dict[str, str]]:
    reactions: list[dict[str, str]] = []

    reaction_list = div.find("ul", class_=re.compile(r"_a6-q"))
    if reaction_list:
        for span in reaction_list.find_all("span"):
            parsed = _parse_compact_reaction(span.get_text(strip=True))
            if parsed:
                reactions.append(parsed)

    if reactions:
        return reactions

    for span in div.find_all(["span", "li"]):
        text = span.get_text(strip=True)
        if not text or not _is_emoji_heavy(text):
            continue

        # Try to find actor from parent or sibling text
        actor = ""
        parent = span.parent
        if parent:
            siblings_text = parent.get_text(separator=" ", strip=True)
            # Remove the emoji part and see if something name-like is left
            candidate = siblings_text.replace(text, "").strip()
            if 0 < len(candidate) < 80:
                actor = _decode_str(candidate)

        reactions.append({"actor": actor, "reaction": text})

    return reactions


def _extract_content(div: Tag) -> str:
    content_container = div.find("div", class_=re.compile(r"_a6-p"))
    if not content_container:
        return div.get_text(separator=" ", strip=True)

    reaction_list = content_container.find("ul", class_=re.compile(r"_a6-q"))
    if reaction_list:
        reaction_list.extract()

    return content_container.get_text(separator=" ", strip=True)


def _extract_reaction_event(sender: str, content: str) -> dict[str, str] | None:
    if not content:
        return None

    match = re.search(r"Reacted\s+(.+?)\s+to\s+your\s+message", content, re.I)
    if match:
        return {
            "actor": sender,
            "reaction": match.group(1).strip(),
        }

    match = re.search(r"reacted\s+(.+?)\s+to\s+your\s+message", content, re.I)
    if match:
        return {
            "actor": sender,
            "reaction": match.group(1).strip(),
        }

    return None


def _parse_compact_reaction(text: str) -> dict[str, str] | None:
    if not text:
        return None

    index = 0
    while index < len(text) and _is_emoji_char(text[index]):
        index += 1

    reaction = text[:index].strip()
    actor = text[index:].strip()
    if reaction and actor:
        return {"actor": _decode_str(actor), "reaction": reaction}
    return None


def _is_emoji_char(ch: str) -> bool:
    return unicodedata.category(ch) in ("So", "Sm", "Sk") or ord(ch) > 0x1F300


def _looks_like_message_block(div: Tag) -> bool:
    return bool(
        div.find(["h1", "h2", "h3", "strong", "b"])
        and div.find("div", class_=re.compile(r"_a6-o|_3-94"))
    )


def _is_emoji_heavy(text: str) -> bool:
    """Return True if the string consists mostly of emoji/symbol characters."""
    if len(text) > 12:
        return False
    emoji_chars = sum(
        1
        for ch in text
        if unicodedata.category(ch) in ("So", "Sm", "Sk") or ord(ch) > 0x1F300
    )
    return emoji_chars > 0 and emoji_chars / len(text) >= 0.5


# ---------------------------------------------------------------------------
# Encoding helper (shared with JSON parser)
# ---------------------------------------------------------------------------

def _decode_str(s: str) -> str:
    if not s:
        return s
    try:
        return s.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s
