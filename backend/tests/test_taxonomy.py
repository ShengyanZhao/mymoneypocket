"""The category words come from one place, and old rows stay readable.

The vocabularies moved out of the frontend (PRD §3) so the importer's rules
and the forms can never offer two different sets. What this asserts is the
small contract on top: an alias reads an old code as its new name, and a code
nobody has named reads as itself rather than as nothing."""

from __future__ import annotations

from app import taxonomy


def test_the_api_hands_out_the_three_vocabularies(client):
    body = client.get("/api/taxonomy").json()
    assert "dining" in body["expense"]
    assert "wage" in body["income"]
    # A statement row may be a transfer between the reader's own pockets,
    # which is neither income nor spending.
    assert "transfer" in body["entry"] and "transfer" not in body["expense"]
    assert body["aliases"]["salary"] == "wage"


def test_an_old_code_reads_as_its_new_name_and_a_stranger_as_itself():
    assert taxonomy.display_code("salary") == "wage"
    assert taxonomy.display_code("food") == "dining"
    assert taxonomy.display_code("dining") == "dining"
    assert taxonomy.display_code("某人自己起的") == "某人自己起的"
    assert taxonomy.display_code(None) is None


def test_the_importers_rules_name_no_word_the_taxonomy_refuses():
    """The two vocabularies meet here or they drift: a rule that suggests a
    category no form offers files a row where nothing can find it."""
    from app import importers

    assert {c for _, c in importers.CATEGORY_RULES} <= set(taxonomy.ENTRY)
