"""The one place a language model is called.

Isolated deliberately. Everything that decides *whether* to answer, *what* may be
said and *what evidence* is allowed lives in `api.domain.assist` and is pure — this
module only takes a prompt that has already passed those gates and returns text.

**Never raises into a caller.** A model provider being slow, rate-limited or down is
not a reason for a coordinator's screen to break. It returns `None`, and the endpoint
degrades to showing the retrieved passages with their sources — which is still useful,
and is honestly what most of the value is.

**The model is configuration, not code.** `OPENROUTER_MODEL` names the slug; nothing
here hardcodes one. Provider catalogues change faster than deploys, and a slug baked
into a source file is a silent 404 the day it is renamed. When the configured model
is wrong, OpenRouter's error is surfaced verbatim rather than swallowed, so the cause
is visible instead of appearing as "the assistant stopped working".
"""

from __future__ import annotations

import logging

import httpx

from api.config import get_settings

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

#: Short. A coordinator is waiting with a traveller on WhatsApp, and a draft that
#: takes 30 seconds is one they have already typed themselves.
TIMEOUT_SECONDS = 20.0


def is_configured() -> bool:
    settings = get_settings()
    return bool(settings.openrouter_api_key and settings.openrouter_model)


def configured_model() -> str | None:
    """Surfaced in the response so a reviewer knows what wrote the draft.

    Doc 08 requires logging and evaluation; comparing answer quality across a model
    change is impossible if the model that produced each one was not recorded.
    """
    return get_settings().openrouter_model or None


async def complete(system: str, user: str, *, temperature: float = 0.2) -> str | None:
    """One completion, or None.

    Low temperature on purpose. This is not a creative task — it is restating
    approved content accurately, and the failure mode we care about is embellishment.
    """
    settings = get_settings()
    if not is_configured():
        return None

    payload = {
        "model": settings.openrouter_model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }
    # OpenRouter asks for these for attribution. Each is sent only when configured
    # and omitted rather than faked otherwise — the origin waits on decision O7, and
    # the name comes from the environment because D4 forbids a brand string in source.
    # This file is where the first run of `bun run check:brand` found one.
    if settings.public_site_origin:
        headers["HTTP-Referer"] = settings.public_site_origin
    if settings.public_brand_name:
        headers["X-Title"] = settings.public_brand_name

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.post(OPENROUTER_URL, json=payload, headers=headers)
        if response.status_code != 200:
            # Verbatim, truncated. A wrong model slug returns a precise message here
            # and hiding it turns a one-line config fix into an afternoon.
            logger.warning(
                "OpenRouter %s for model %r: %s",
                response.status_code,
                settings.openrouter_model,
                response.text[:400],
            )
            return None
        data = response.json()
        choices = data.get("choices") or []
        if not choices:
            logger.warning("OpenRouter returned no choices: %s", str(data)[:400])
            return None
        return (choices[0].get("message") or {}).get("content")
    except Exception as exc:  # noqa: BLE001 — a provider outage must not break the screen
        logger.warning("OpenRouter call failed: %s", exc)
        return None
