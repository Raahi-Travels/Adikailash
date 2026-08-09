"""Resolving localized JSONB fields for a requested locale.

The API resolves server-side rather than shipping the whole `{"en":..,"hi":..}` object
to the client. Two reasons: the Next.js layer already knows the locale from the route
segment, and a partially-translated field should degrade to English in exactly one
place rather than in every component that renders it.
"""

from __future__ import annotations

from typing import Any

DEFAULT_LOCALE = "en"
SUPPORTED_LOCALES = ("en", "hi")


def resolve(value: dict[str, Any] | None, locale: str) -> str | None:
    """Text for ``locale``, falling back to English, then to any present value.

    Returns ``None`` rather than an empty string when nothing is available, so
    callers must decide what an absent value looks like instead of silently
    rendering a blank where a journey name should be.
    """
    if not value:
        return None
    for key in (locale, DEFAULT_LOCALE):
        text = value.get(key)
        if isinstance(text, str) and text.strip():
            return text
    for text in value.values():
        if isinstance(text, str) and text.strip():
            return text
    return None


def is_translated(value: dict[str, Any] | None, locale: str) -> bool:
    """Whether a genuine translation exists for this locale.

    Lets the admin show translators what is still missing, and lets a Hindi page
    avoid claiming to be Hindi when it is really English text in a Devanagari font.
    """
    if not value or locale == DEFAULT_LOCALE:
        return bool(value)
    text = value.get(locale)
    return isinstance(text, str) and bool(text.strip())


def normalise_locale(raw: str | None) -> str:
    """Map an incoming locale hint onto a supported locale."""
    if not raw:
        return DEFAULT_LOCALE
    head = raw.split(",")[0].split("-")[0].strip().lower()
    return head if head in SUPPORTED_LOCALES else DEFAULT_LOCALE
