"""
Guard rails around the trip assistant (FR-37), applied at the one place text
crosses to or from the model, so nothing depends on every caller remembering.

- scrub: personal data and secrets never leave this service for Gemini, and
  never come back to the traveller, even if one slipped into a trip note or the
  model repeats it.
- is_probe: a request to reveal the instructions or drop the rules is answered
  with a fixed line and never reaches the model (no quota spent).
- leaks_instructions: a reply that quotes the instructions or the fact block is
  replaced.

Pattern matching is a safety net, not a guarantee; the Core API's first line of
defence is that it never puts e-mails, other travellers' names or documents in
the context at all.
"""

from __future__ import annotations

import re

REFUSAL = "I can only help with your trip and travel questions."
WITHHELD = "I can't share that. Ask me about your trip or travelling instead."

# What counts as personal data or a secret in text heading to, or coming back from,
# the model. Each pattern replaces its match with a placeholder. Order matters:
# card-length digit runs must be matched before the looser phone pattern, or a card
# number would be caught as a phone number and the label would be wrong.
#   email: local@domain.tld
#   JWT: three base64url segments, starting "eyJ" (the encoding of '{"')
#   secret: Google AIza keys, sk- keys, long hex and long base64-like strings
#   card: 13 to 19 digits, optionally separated by spaces or hyphens
#   phone: optional country code, then groups of digits separated by common punctuation
_PATTERNS = [
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+"), "[email removed]"),
    (re.compile(r"eyJ[\w-]{4,}\.[\w-]{4,}\.[\w-]{4,}"), "[secret removed]"),  # JWT
    (re.compile(r"\b(?:AIza[\w-]{30,}|sk-[\w-]{20,}|[A-Fa-f0-9]{32,}|[A-Za-z0-9+/_-]{40,})\b"), "[secret removed]"),
    (re.compile(r"(?<![\w-])(?:\d[ -]?){13,19}(?![\w-])"), "[number removed]"),  # card-length
    (re.compile(r"(?<![\w-])\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?![\w-])"), "[number removed]"),  # phone
]

_PROBES = [
    re.compile(r"ignore\s+(all\s+|any\s+|your\s+|the\s+)?(previous|prior|above|earlier)\s+(instructions|prompts?|rules)", re.I),
    re.compile(r"(reveal|show|print|repeat|output|tell me|leak)\b.{0,40}\b(system\s+prompt|your\s+(instructions|rules)|trip\s+facts)", re.I),
    re.compile(r"\b(jailbreak|developer\s+mode|do\s+anything\s+now)\b", re.I),
    re.compile(r"(other|another|all)\s+(users?|travell?ers?|accounts?)('s|s')?\s+(trips?|data|details|emails?|passwords?)", re.I),
]

_LEAK_MARKERS = ("TRIP FACTS", "<trip_facts>", "Roamio's travel assistant. Answer")


def scrub(text: str) -> str:
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def is_probe(text: str) -> bool:
    return any(p.search(text) for p in _PROBES)


def leaks_instructions(reply: str) -> bool:
    return any(marker in reply for marker in _LEAK_MARKERS)
