"""
analytics.py
------------
Pure analytics engine that operates on the unified message format produced
by the parsers.  No I/O, no Streamlit — just functions.

Unified message schema (dict):
    sender_name : str
    timestamp   : datetime
    is_reel     : bool
    reel_link   : str | None
    reactions   : list[{"actor": str, "reaction": str}]
    content     : str

Return schema of compute_analytics():
    reels_sent       : dict[user, int]
    replies_received : dict[reel_sender, int]   — reels that got ≥1 reply
    reaction_totals  : dict[reel_sender, int]   — total reactions on their reels
    reactions_by_user: dict[reel_sender, dict[reactor, int]]
    reply_rate       : dict[user, float]         — percentage, 0-100
    total_reels      : int
    total_replies    : int
    total_reactions  : int
    participants     : list[str]
    engagement_score : float   — weighted score 0-100
    most_active_user : str | None
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

_REPLY_WINDOW_HOURS = 24  # max gap between a reel and its first reply


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_analytics(messages: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute full analytics for a single chat's message list."""
    if not messages:
        return _empty_analytics()

    participants: list[str] = sorted({m["sender_name"] for m in messages})

    # ── 1. Reels sent ──────────────────────────────────────────────────────
    reels_sent: dict[str, int] = defaultdict(int)
    reactions_by_user: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    reaction_totals: dict[str, int] = defaultdict(int)

    for msg in messages:
        if not msg["is_reel"]:
            continue
        sender = msg["sender_name"]
        reels_sent[sender] += 1

        for rxn in msg.get("reactions", []):
            actor = rxn.get("actor", "Unknown")
            reactions_by_user[sender][actor] += 1
            reaction_totals[sender] += 1

    _apply_reaction_events(messages, reactions_by_user, reaction_totals)

    # ── 2. Replies ─────────────────────────────────────────────────────────
    replies_received = _count_replies(messages)

    # ── 3. Derived metrics ─────────────────────────────────────────────────
    reply_rate: dict[str, float] = {}
    for user, reel_count in reels_sent.items():
        got_reply = replies_received.get(user, 0)
        reply_rate[user] = round(got_reply / reel_count * 100, 1) if reel_count else 0.0

    total_reels = sum(reels_sent.values())
    total_replies = sum(replies_received.values())
    total_reactions = sum(reaction_totals.values())

    engagement_score = _engagement_score(total_reels, total_replies, total_reactions)
    most_active = max(reels_sent, key=lambda u: reels_sent[u]) if reels_sent else None

    return {
        "reels_sent": dict(reels_sent),
        "replies_received": dict(replies_received),
        "reactions_by_user": {k: dict(v) for k, v in reactions_by_user.items()},
        "reaction_totals": dict(reaction_totals),
        "reply_rate": reply_rate,
        "total_reels": total_reels,
        "total_replies": total_replies,
        "total_reactions": total_reactions,
        "participants": participants,
        "engagement_score": engagement_score,
        "most_active_user": most_active,
    }


def compute_all_chats(
    all_chats: dict[str, list[dict[str, Any]]]
) -> dict[str, dict[str, Any]]:
    """Compute analytics for every chat in the export."""
    return {name: compute_analytics(msgs) for name, msgs in all_chats.items()}


def find_most_active_chat(all_analytics: dict[str, dict[str, Any]]) -> str | None:
    """Return the chat name with the highest reel volume."""
    if not all_analytics:
        return None
    return max(all_analytics, key=lambda c: all_analytics[c]["total_reels"])


# ---------------------------------------------------------------------------
# Reply counting
# ---------------------------------------------------------------------------

def _count_replies(messages: list[dict[str, Any]]) -> dict[str, int]:
    """
    For every reel in *messages*, check whether the *first* subsequent message
    from a *different* user arrived within _REPLY_WINDOW_HOURS.
    Returns {reel_sender: count_of_reels_that_got_a_reply}.
    """
    reply_counts: dict[str, int] = defaultdict(int)
    window = timedelta(hours=_REPLY_WINDOW_HOURS)

    for idx, msg in enumerate(messages):
        if not msg["is_reel"]:
            continue

        reel_sender: str = msg["sender_name"]
        reel_time: datetime = msg["timestamp"]

        for j in range(idx + 1, len(messages)):
            next_msg = messages[j]
            if next_msg["sender_name"] == reel_sender:
                continue  # same sender – not a reply
            if _is_non_reply_event(next_msg):
                continue
            if next_msg["timestamp"] - reel_time > window:
                break  # too late – no more candidates
            reply_counts[reel_sender] += 1
            break  # only first reply counts

    return dict(reply_counts)


# ---------------------------------------------------------------------------
# Engagement score
# ---------------------------------------------------------------------------

def _engagement_score(total_reels: int, total_replies: int, total_reactions: int) -> float:
    """
    Weighted engagement score (0–100).
    formula: (reply_rate * 0.60 + reaction_rate * 0.40) * 100
    Capped at 100.
    """
    if total_reels == 0:
        return 0.0
    reply_rate = total_replies / total_reels
    reaction_rate = total_reactions / total_reels
    score = (reply_rate * 0.60 + reaction_rate * 0.40) * 100
    return round(min(score, 100.0), 2)


def _apply_reaction_events(
    messages: list[dict[str, Any]],
    reactions_by_user: dict[str, dict[str, int]],
    reaction_totals: dict[str, int],
) -> None:
    for idx, msg in enumerate(messages):
        event = msg.get("reaction_event")
        if not event:
            continue

        actor = event.get("actor") or msg["sender_name"]
        reaction = event.get("reaction", "")
        target_idx = _find_reaction_target(messages, idx, actor, reaction)
        if target_idx is None:
            continue

        reel_sender = messages[target_idx]["sender_name"]
        reactions_by_user[reel_sender][actor] += 1
        reaction_totals[reel_sender] += 1


def _find_reaction_target(
    messages: list[dict[str, Any]],
    event_index: int,
    actor: str,
    reaction: str,
) -> int | None:
    for idx in range(event_index - 1, -1, -1):
        candidate = messages[idx]
        if not candidate.get("is_reel"):
            continue
        if candidate["sender_name"] == actor:
            continue
        if _reaction_already_present(candidate, actor, reaction):
            return None
        return idx
    return None


def _reaction_already_present(message: dict[str, Any], actor: str, reaction: str) -> bool:
    for item in message.get("reactions", []):
        if item.get("actor") == actor and item.get("reaction") == reaction:
            return True
    return False


def _is_non_reply_event(message: dict[str, Any]) -> bool:
    if message.get("reaction_event"):
        return True

    content = str(message.get("content", "")).strip().lower()
    if not content:
        return False

    reaction_phrases = (
        "reacted ",
        "liked a message",
        "liked your message",
    )
    return any(phrase in content for phrase in reaction_phrases)


# ---------------------------------------------------------------------------
# Empty result sentinel
# ---------------------------------------------------------------------------

def _empty_analytics() -> dict[str, Any]:
    return {
        "reels_sent": {},
        "replies_received": {},
        "reactions_by_user": {},
        "reaction_totals": {},
        "reply_rate": {},
        "total_reels": 0,
        "total_replies": 0,
        "total_reactions": 0,
        "participants": [],
        "engagement_score": 0.0,
        "most_active_user": None,
    }
