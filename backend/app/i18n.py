"""Which language the words the BACKEND says are in.

The frontend sends `Accept-Language` on every request and writes its own
labels around whatever comes back. Without this module the two disagree at
every seam: a Chinese button asking a question an English error answers, a
Chinese page of cards whose titles are English.

WHAT LIVES HERE, AND WHAT DOES NOT. This is the lookup and the plumbing —
which language is in force for THIS request, and how a message is assembled
from a key and its placeholders. The words themselves live in
`app/messages.py`, in two dictionaries that must name exactly the same keys:
`tests/test_i18n.py` checks that, so a message cannot exist in one language
and not the other.

WHY A ContextVar AND NOT A PARAMETER. Validation errors are raised inside
Pydantic, long before any route function has a request to read a header from.
A contextvar is set once per request by `LocaleMiddleware`, and every call
site that says anything reads it — a validator, a CRUD helper, a tool the
model invokes — without threading a locale through a dozen signatures that
have no other use for it.

`locale=None` on `t` is a real answer, not a missing one: it means "say this
in whatever language is in force", which is almost always what a call site
wants. Passing one explicitly is for the tests, which assert both languages
without flipping the app's out from under each other.
"""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Literal, Mapping

from app.messages import EN, ZH

Locale = Literal["en", "zh"]

# BCP 47 tags the reader can actually have set, mapped to the language this
# app has words for. Everything else falls back to English, which is the
# language the code and the catalogue were written in first.
_TAGS: dict[str, Locale] = {
    "en": "en",
    "zh": "zh",
}

_current: ContextVar[Locale] = ContextVar("aurelio_locale", default="en")

CATALOGUES: Mapping[Locale, Mapping[str, str]] = {"en": EN, "zh": ZH}


def parse_accept_language(header: str | None) -> Locale:
    """The language this app has words for, from an `Accept-Language` header.

    The header is a quality-ordered list ("zh-CN,zh;q=0.9,en;q=0.8"). We take
    the first tag whose language we have, and ignore the q-values: this app has
    two languages, and ordering is enough to choose between them. A header we
    cannot read is English, not an error — a client that sends nothing still
    gets an app that works.
    """
    if not header:
        return "en"
    for part in header.split(","):
        tag = part.split(";")[0].strip().lower()
        if not tag:
            continue
        language = tag.split("-")[0]
        if language in _TAGS:
            return _TAGS[language]
    return "en"


def get_locale() -> Locale:
    return _current.get()


def set_locale(locale: Locale) -> None:
    _current.set(locale)


@contextmanager
def use_locale(locale: Locale):
    """A context manager that puts `locale` in force and takes it away again.

    For tests and for anything that speaks on behalf of a specific reader
    rather than the one whose request this is.
    """
    token = _current.set(locale)
    try:
        yield locale
    finally:
        _current.reset(token)


def _fill(template: str, params: Mapping[str, Any] | None) -> str:
    if not params:
        return template
    out = template
    for name, value in params.items():
        out = out.replace("{" + name + "}", "" if value is None else str(value))
    return out


def _pick(value: str, params: Mapping[str, Any] | None) -> str:
    """The one/two of a count, where the language has the distinction.

    A `|` in a message splits them: `"1 thing|2 things"`. `params["count"]`
    decides. Chinese has no such distinction and writes one form with no `|`
    in it, so this is a no-op there — which is why the split lives in the
    value rather than in the key.
    """
    if params is None or "count" not in params or params["count"] is None:
        return value
    parts = value.split("|")
    if len(parts) < 2:
        return value
    try:
        n = float(params["count"])
    except (TypeError, ValueError):
        return parts[-1]
    return parts[0] if n == 1 else parts[-1]


def t(key: str, /, *, locale: Locale | None = None, **params: Any) -> str:
    """The words for `key`, in the language in force, with placeholders filled.

    A key nothing has been written for reads back as itself. That is the shape
    of a missing message that is easiest to spot in a running app and hardest
    to mistake for a translation.
    """
    words = CATALOGUES[locale or get_locale()].get(key)
    if words is None:
        return key
    return _fill(_pick(words, params), params)


class LocaleMiddleware:
    """Put the reader's language in force for the length of one request.

    Pure ASGI, no FastAPI: it runs before routing, so a validation error
    raised while the body is being parsed still finds the language it should
    be said in.
    """

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: dict, receive: Any, send: Any) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return
        header = None
        for name, value in scope.get("headers", []):
            if name == b"accept-language":
                header = value.decode("latin-1")
                break
        token = _current.set(parse_accept_language(header))
        try:
            await self.app(scope, receive, send)
        finally:
            _current.reset(token)
