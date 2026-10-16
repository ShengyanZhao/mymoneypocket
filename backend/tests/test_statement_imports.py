"""The statement lane: import a file twice, and the second time writes nothing.

China iteration M1. An Alipay or WeChat statement is one-off movements — a
payment here, a receipt there — and this file is about the three promises the
lane makes:

- IDEMPOTENT: the same file twice adds no row twice. The statement's own
  transaction number (`external_id`) is the whole of it, checked against the
  STORE and not the file, so two overlapping exports also meet.
- UNDOABLE: one import is one batch, and deleting the batch takes exactly its
  rows with it — a hand-typed row sitting between them stays.
- HONEST: a line the parser cannot read is reported with its own words
  (`unreadable`), a row that is not money moving (a closed order) is refused
  with its status named, and a category is a suggestion the reader confirms.

Run against the API (`client`), because the batch's identity — which rows are
its — is the router's promise as much as the crud's.
"""

from __future__ import annotations

import datetime

from app import importers

ALIPAY = """\
支付宝交易记录明细查询
账号:[someone@example.com]
起始日期:[2026-09-01 00:00:00]    终止日期:[2026-09-30 23:59:59]
---------------------------------交易记录明细列表------------------------------------
------------------------共3笔记录账单明细列表--------------------
交易号,商家订单号,交易创建时间,付款时间,最近修改时间,交易来源地,类型,交易对方,商品名称,金额（元）,收/支,交易状态,服务费（元）,成功退款（元）,备注,资金状态
2026110300001,ORDER1,2026-09-03 12:00:07,2026-09-03 12:00:09,2026-09-03 12:00:09,即时到账,即时到账,美团,午餐外卖,42.50,支出,交易成功,0.00,0.00,,已支出
2026110500002,ORDER2,2026-09-05 09:00:00,2026-09-05 09:00:02,2026-09-05 09:00:02,即时到账,即时到账,招商银行,提现-转出到银行卡,500.00,支出,交易成功,0.00,0.00,,已支出
2026110700003,ORDER3,2026-09-07 20:00:00,2026-09-07 20:00:01,2026-09-07 20:00:01,即时到账,即时到账,淘宝,某笔已关闭的订单,30.00,支出,交易关闭,0.00,0.00,,已支出
"""

WECHAT = """\
微信支付账单明细
微信昵称：[张三]
起始时间：[2026-09-01 00:00:00] 终止时间：[2026-09-30 23:59:59]
导出时间：[2026-12-01 10:00:00]
----------------------微信支付账单明细列表--------------------
交易单号,商户单号,交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
4200001,M1,2026-09-05 18:22:10,转账,张三,微信转账-收款,收入,200.00,零钱,已收钱,4200001,M1,朋友还款
4200002,M2,2026-09-06 08:30:00,消费,瑞幸咖啡,拿铁,支出,19.90,零钱通,支付成功,4200002,M2,
"""


def _upload(client, content: str | bytes, name: str = "bill.csv"):
    """POST one statement to the preview route, GBK bytes as both apps write."""
    raw = content.encode("gbk") if isinstance(content, str) else content
    return client.post(
        "/api/imports/preview",
        files={"file": (name, raw, "text/csv")},
    )


def _account(client, name: str = "支付宝") -> int:
    return client.post("/api/institutions", json={"name": name, "type": "payment_wallet"}).json()["id"]


# --- Reading the two statements ------------------------------------------


def test_gbk_is_read_not_assigned():
    """Both apps write GBK. The bytes come out as the words they are."""
    assert importers.decode("美团午餐".encode("gbk")) == "美团午餐"


def test_an_alipay_statement_reads_to_rows():
    source, rows, unreadable = importers.parse(ALIPAY)
    assert source == "alipay"
    assert [(r["date"].isoformat(), r["direction"], r["amount"]) for r in rows] == [
        ("2026-09-03", "out", 42.5),
        ("2026-09-05", "out", 500.0),
    ]
    # The closed order moved no money, and its line is said rather than dropped.
    assert len(unreadable) == 1 and "交易关闭" in unreadable[0]


def test_a_wechat_statement_reads_to_rows():
    source, rows, unreadable = importers.parse(WECHAT)
    assert source == "wechat"
    assert [(r["external_id"], r["direction"], r["amount"]) for r in rows] == [
        ("4200001", "in", 200.0),
        ("4200002", "out", 19.9),
    ]
    assert rows[0]["counterparty"] == "张三"


def test_a_file_that_is_neither_refuses_rather_than_guessing():
    source, rows, unreadable = importers.parse("not,a,statement,at,all\n1,2,3,4,5")
    assert source == "unknown"
    assert rows == []
    assert unreadable


# --- Categories are suggestions ------------------------------------------


def test_a_category_the_rules_see_is_suggested_and_none_is_left_alone():
    assert importers.suggest_category("美团", "午餐外卖") == "dining"
    assert importers.suggest_category("张三", "微信转账-收款") == "transfer"
    # A stranger's name gets NO category: "other" everywhere is the same as
    # nothing said, and the preview's null is the honest answer.
    assert importers.suggest_category("某某便利店", None) is None


# --- Preview changes nothing ----------------------------------------------


def test_the_preview_writes_nothing(client):
    out = _upload(client, ALIPAY)
    assert out.status_code == 200
    body = out.json()
    assert body["source"] == "alipay"
    assert body["rows_seen"] == 2
    assert body["candidates"][0]["category"] == "dining"
    assert client.get("/api/cash-entries").json() == []


# --- Idempotence: the same file twice -------------------------------------


def test_importing_the_same_file_twice_writes_the_rows_once(client):
    iid = _account(client)
    preview = _upload(client, ALIPAY).json()
    commit = {
        "institution_id": iid,
        "source": preview["source"],
        "filename": preview["filename"],
        "candidates": preview["candidates"],
    }
    first = client.post("/api/imports/commit", json=commit)
    assert first.status_code == 200
    assert first.json()["written"] == 2

    second = client.post("/api/imports/commit", json=commit)
    assert second.status_code == 200
    assert second.json()["written"] == 0
    assert second.json()["duplicates_skipped"] == 2

    assert len(client.get("/api/cash-entries").json()) == 2
    # Two batches on record — the second one wrote nothing, and says so.
    batches = client.get("/api/imports").json()
    assert [b["rows_written"] for b in batches] == [0, 2]


# --- One import is one undo ------------------------------------------------


def test_deleting_a_batch_takes_its_rows_and_keeps_the_rest(client):
    iid = _account(client)
    preview = _upload(client, WECHAT).json()
    batch = client.post(
        "/api/imports/commit",
        json={
            "institution_id": iid,
            "source": preview["source"],
            "filename": preview["filename"],
            "candidates": preview["candidates"],
        },
    ).json()["batch"]

    hand = client.post(
        "/api/cash-entries",
        json={
            "date": "2026-09-10",
            "direction": "out",
            "amount": 5.0,
            "currency": "CNY",
            "institution_id": iid,
            "note": "typed by hand",
        },
    )
    assert hand.status_code == 201

    r = client.delete(f"/api/imports/{batch['id']}")
    assert r.status_code == 204
    left = client.get("/api/cash-entries").json()
    assert [e["note"] for e in left] == ["typed by hand"]


# --- Transfer pairs --------------------------------------------------------


def test_a_transfer_the_importer_suspects_is_shown_before_anything(client):
    preview = _upload(client, ALIPAY).json()
    pairs = preview["transfer_pairs"]
    # 500.00 out to 招商银行 (提现) has no in-side in this file: no pair is
    # invented. The demo file's rows are both `out`, so this is the empty case
    # asserted on purpose — a pair needs BOTH sides.
    assert pairs == []


def test_two_sides_of_one_transfer_are_paired_and_marked(client):
    """Out of one pocket, into another, same sum, one of them naming it."""
    text = ALIPAY.replace(
        "2026110700003,ORDER3,2026-09-07 20:00:00,2026-09-07 20:00:01,2026-09-07 20:00:01,即时到账,即时到账,淘宝,某笔已关闭的订单,30.00,支出,交易关闭,0.00,0.00,,已支出",
        "2026110600003,ORDER3,2026-09-06 20:00:00,2026-09-06 20:00:01,2026-09-06 20:00:01,即时到账,即时到账,余额宝,余额宝转入,500.00,收入,交易成功,0.00,0.00,,已收入",
    )
    iid = _account(client)
    preview = _upload(client, text).json()
    assert [(p["out_index"], p["in_index"]) for p in preview["transfer_pairs"]] == [(1, 2)]

    client.post(
        "/api/imports/commit",
        json={
            "institution_id": iid,
            "source": preview["source"],
            "filename": preview["filename"],
            "candidates": preview["candidates"],
            "pair_indices": [[1, 2]],
        },
    )
    legs = [e for e in client.get("/api/cash-entries").json() if e["is_transfer_leg"]]
    assert len(legs) == 2
    # Both sides stay visible and both move the balance, one each way: no
    # Transfer carries them yet, so nothing is double-counted or dropped.
    assert all(e["linked_transfer_id"] is None for e in legs)


# --- Hand-typed rows -------------------------------------------------------


def test_a_movement_can_be_typed_and_its_reading_corrected(client):
    iid = _account(client)
    made = client.post(
        "/api/cash-entries",
        json={
            "date": "2026-09-11",
            "direction": "out",
            "amount": 66.6,
            "currency": "CNY",
            "institution_id": iid,
            "counterparty": "某便利店",
        },
    ).json()
    fixed = client.patch(f"/api/cash-entries/{made['id']}", json={"category": "dining"})
    assert fixed.status_code == 200
    assert fixed.json()["category"] == "dining"
    # The money is not settable through an edit: a corrected sum is a deleted
    # row and a typed one, so no edit can move a balance.
    untouched = client.patch(f"/api/cash-entries/{made['id']}", json={"amount": 1.0})
    assert untouched.json()["amount"] == 66.6
