"""
parser_unified.py
-----------------
Orchestrates ZIP extraction and dispatches to the correct format-specific
parser (JSON-first, then HTML fallback).

Public surface:
    parse_zip(zip_path)  → dict[chat_name, list[unified_message]]
    parse_chat(folder)   → list[unified_message]   (single folder)
    find_chat_folders(base_dir) → dict[chat_name, folder_path]
"""

from __future__ import annotations

import os
import tempfile
import zipfile
from typing import Any

from parser_json import parse_json_chat
from parser_html import parse_html_chat


# ---------------------------------------------------------------------------
# ZIP entry-point
# ---------------------------------------------------------------------------

def parse_zip(zip_path: str) -> dict[str, list[dict[str, Any]]]:
    """
    Extract the ZIP, locate all chat folders, parse each one, and return:
        {chat_folder_name: [unified_message, …]}

    Only chats that contain at least one message are included.
    The temporary directory is cleaned up automatically.
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        _extract_zip(zip_path, tmp_dir)
        chat_folders = find_chat_folders(tmp_dir)

        results: dict[str, list[dict[str, Any]]] = {}
        for chat_name, folder_path in chat_folders.items():
            messages = parse_chat(folder_path)
            if messages:
                results[chat_name] = messages

    return results


# ---------------------------------------------------------------------------
# Chat folder discovery
# ---------------------------------------------------------------------------

# Paths that various Instagram export versions place the inbox directory at.
_INBOX_CANDIDATES = [
    os.path.join("messages", "inbox"),
    os.path.join("your_instagram_activity", "messages", "inbox"),
    os.path.join("data", "messages", "inbox"),
]


def find_chat_folders(base_dir: str) -> dict[str, str]:
    """
    Walk *base_dir* to find folders that contain message_1.json or
    message_1.html, indicating an Instagram chat export folder.
    Returns {folder_name: absolute_path}.
    """
    # Phase 1 – try well-known inbox paths first (fast)
    for rel in _INBOX_CANDIDATES:
        inbox = os.path.join(base_dir, rel)
        if not os.path.isdir(inbox):
            continue
        chats = _scan_inbox_dir(inbox)
        if chats:
            return chats

    # Phase 2 – deep walk (handles non-standard structures)
    chats: dict[str, str] = {}
    for root, _dirs, files in os.walk(base_dir):
        if "message_1.json" in files or "message_1.html" in files:
            folder_name = os.path.basename(root)
            chats[folder_name] = root
    return chats


def _scan_inbox_dir(inbox: str) -> dict[str, str]:
    chats: dict[str, str] = {}
    try:
        for entry in os.scandir(inbox):
            if not entry.is_dir():
                continue
            has_json = os.path.exists(os.path.join(entry.path, "message_1.json"))
            has_html = os.path.exists(os.path.join(entry.path, "message_1.html"))
            if has_json or has_html:
                chats[entry.name] = entry.path
    except PermissionError:
        pass
    return chats


# ---------------------------------------------------------------------------
# Single-chat parsing
# ---------------------------------------------------------------------------

def parse_chat(folder_path: str) -> list[dict[str, Any]]:
    """
    Parse a single chat folder.  JSON is preferred when both formats exist.
    Returns a time-sorted list of unified messages.
    """
    has_json = os.path.exists(os.path.join(folder_path, "message_1.json"))
    has_html = os.path.exists(os.path.join(folder_path, "message_1.html"))

    if has_json:
        return parse_json_chat(folder_path)
    if has_html:
        return parse_html_chat(folder_path)
    return []


# ---------------------------------------------------------------------------
# ZIP extraction helper
# ---------------------------------------------------------------------------

def _extract_zip(zip_path: str, dest_dir: str) -> None:
    """Safely extract ZIP, skipping absolute/path-traversal entries."""
    with zipfile.ZipFile(zip_path, "r") as zf:
        for member in zf.infolist():
            # Guard against path-traversal attacks in ZIP member names
            member_path = os.path.realpath(os.path.join(dest_dir, member.filename))
            if not member_path.startswith(os.path.realpath(dest_dir)):
                continue  # skip dangerous entry
            zf.extract(member, dest_dir)
