"""The two catalogues cannot drift.

A message that exists in English and not in Chinese reads back as its own key
at the reader — `errors.not_found` where a sentence belongs — and the reverse
is a key nothing answers. A message whose placeholders differ is worse: the
sentence still reads as prose, just prose that has forgotten the number or
name it was about. Neither can be seen by looking at the language that is
complete.

Also pins the plumbing: which language a header asks for, and that `t` picks
the one/two of a count only where the language has the distinction.
"""

from __future__ import annotations

import re

import pytest

from app.i18n import (
    CATALOGUES,
    get_locale,
    parse_accept_language,
    t,
    use_locale,
)
from app.messages import EN, ZH

_PLACEHOLDER = re.compile(r"\{(\w+)\}")


def placeholders(value: str) -> set[str]:
    # `|` splits the one/two of a count; both sides are the same message and
    # must carry the same placeholders, so the split is erased before reading.
    return set(_PLACEHOLDER.findall(value.replace("|", " ")))


def test_both_languages_name_the_same_messages():
    english = set(EN)
    chinese = set(ZH)
    assert english - chinese == set(), f"no Chinese words for: {sorted(english - chinese)}"
    assert chinese - english == set(), f"Chinese keys saying nothing in English: {sorted(chinese - english)}"


def test_both_languages_say_every_message_in_the_same_pieces():
    for key in EN:
        assert placeholders(EN[key]) == placeholders(ZH[key]), (
            f"placeholders of {key!r} differ: "
            f"en {sorted(placeholders(EN[key]))} vs zh {sorted(placeholders(ZH[key]))}"
        )


def test_no_message_is_empty():
    for name, catalogue in CATALOGUES.items():
        for key, value in catalogue.items():
            assert value.strip(), f"{name} {key!r} is empty"


def test_counts_are_split_only_where_they_are_counted():
    # Chinese has one form for one and many. A `|` in a Chinese value is not a
    # translation choice, it is a stray character the reader would see.
    for key, value in ZH.items():
        assert "|" not in value, f"zh {key!r} splits a count Chinese does not have: {value!r}"


@pytest.mark.parametrize(
    "header,expected",
    [
        (None, "en"),
        ("", "en"),
        ("en-US,en;q=0.9", "en"),
        ("zh-CN,zh;q=0.9,en;q=0.8", "zh"),
        ("zh", "zh"),
        ("ZH-TW", "zh"),
        ("fr-FR,fr;q=0.9", "en"),  # a language this app has no words for
        ("nonsense", "en"),
        ("zh-CN;q=0.9", "zh"),
    ],
)
def test_the_header_names_the_language_in_force(header, expected):
    assert parse_accept_language(header) == expected


def test_a_message_is_said_in_the_language_in_force():
    with use_locale("en"):
        assert t("label.institution") == "Institution"
    with use_locale("zh"):
        assert t("label.institution") == "机构"
    # And whatever was in force before is put back.
    assert get_locale() == "en"


def test_a_placeholder_arrives_whatever_the_word_order():
    with use_locale("zh"):
        assert t("errors.not_found", label="机构", id=42) == "找不到机构 42"
    with use_locale("en"):
        assert t("errors.not_found", label="Institution", id=42) == "Institution 42 not found"


def test_a_missing_placeholder_is_left_visible_rather_than_blank():
    # A silent blank would be prose missing its fact; a visible `{id}` is a
    # bug someone can name.
    with use_locale("en"):
        assert t("errors.not_found", label="Institution") == "Institution {id} not found"


def test_a_key_nobody_wrote_reads_back_as_itself():
    with use_locale("zh"):
        assert t("no.such.message") == "no.such.message"


def test_a_count_takes_one_at_one_and_the_plural_beyond_it():
    # There is no split message in the catalogue yet; this pins the rule
    # itself, using a throwaway pair so the test does not invent vocabulary.
    from app.messages import EN as e, ZH as z

    e["__test.thing"] = "1 thing|{count} things"
    z["__test.thing"] = "{count} 个东西"
    try:
        with use_locale("en"):
            assert t("__test.thing", count=1) == "1 thing"
            assert t("__test.thing", count=3) == "3 things"
        with use_locale("zh"):
            assert t("__test.thing", count=1) == "1 个东西"
            assert t("__test.thing", count=3) == "3 个东西"
    finally:
        del e["__test.thing"]
        del z["__test.thing"]


def test_the_language_in_force_is_what_a_test_set_and_no_more():
    with use_locale("zh"):
        assert get_locale() == "zh"
        with use_locale("en"):
            assert get_locale() == "en"
        assert get_locale() == "zh"
    assert get_locale() == "en"
