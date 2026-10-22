import { useEffect, useState, type FormEvent } from "react";
import { getBaseCurrency } from "../api/baseCurrency";
import { createCashEntry, getTaxonomy, type TaxonomyRead } from "../api/imports";
import { getInstitutions, type Institution } from "../api/institutions";
import { getMembers, type Member } from "../api/members";
import { MemberPicker } from "./MemberPicker";
import { apiError, btnClass, CancelButton, inputClass, todayISO } from "./ui";
import { tOpt, useT } from "../i18n/index.ts";

/* QuickEntry — the 记一笔 panel behind the centre button.

   Three seconds and three touches is the whole design brief: amount,
   category, save. Everything else (counterparty, date, account, note) is
   there for the reader who wants it and costs the hurried one nothing,
   because the cursor starts in the amount box and Enter saves.

   It writes ONE hand-typed movement through `POST /api/cash-entries` — the
   same route the statement lane's confirmed rows describe — so a quick
   entry and an imported row are the same kind of thing everywhere else in
   the app: the same categories, the same cash projection, the same list to
   delete from. No new model, no second ledger.

   A bottom sheet on a phone (where it is reached from the tab bar), a small
   centred card on a desktop (where the full forms are one click away and
   this is only for the two-second case). Mounted only while it is open —
   which is also what makes the date box open on today, every time. */
export default function QuickEntry({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const tr = useT();
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [date, setDate] = useState(todayISO);
  const [institutionId, setInstitutionId] = useState("");
  const [note, setNote] = useState("");
  const [taxonomy, setTaxonomy] = useState<TaxonomyRead | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  // Whose this movement is; null = 共同. The first question after the amount,
  // because on a phone it is usually what the reader has to decide.
  const [memberId, setMemberId] = useState<number | null>(null);
  const [currency, setCurrency] = useState("CNY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read on mounting rather than kept for the session: an account added in
  // another tab should be choosable here without a reload. A failure leaves
  // the panel usable — the category box simply offers nothing, and the amount
  // is still the part that matters.
  useEffect(() => {
    void Promise.all([getTaxonomy(), getInstitutions(), getBaseCurrency(), getMembers()])
      .then(([tax, insts, base, people]) => {
        setTaxonomy(tax);
        setInstitutions(insts);
        setCurrency(base.base_currency);
        setMembers(people);
      })
      .catch((e) => setError(apiError(e, tr("quick.failed"))));
    // `tr` changes with the language, which should not refetch; the mount is
    // the trigger this effect is written around.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const codes = direction === "out" ? (taxonomy?.expense ?? []) : (taxonomy?.income ?? []);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    // Tolerate the punctuation a phone's number pad and a paste can leave
    // behind: "1,234.50" and "1，234.50" are both the amount the reader meant.
    const value = Number(amount.replace(/[,，\s]/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      setError(tr("quick.amountNeeded"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createCashEntry({
        date,
        direction,
        amount: value,
        currency,
        category: category || null,
        counterparty: counterparty.trim() || null,
        channel: null,
        note: note.trim() || null,
        institution_id: institutionId ? Number(institutionId) : null,
        member_id: memberId,
      });
      // Cleared for the NEXT entry, which is usually the next minute's:
      // two lunches in a row should not mean retyping everything but one.
      setAmount("");
      setCategory("");
      setCounterparty("");
      setNote("");
      onSaved();
      onClose();
    } catch (e) {
      setError(apiError(e, tr("quick.failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr("quick.title")}
        onClick={(e) => e.stopPropagation()}
        className={
          "max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-lg " +
          "sm:max-w-lg sm:rounded-2xl"
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-ink">{tr("quick.title")}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr("common.cancel")}
              className="px-2 py-1 text-ink-faint hover:text-ink"
            >
              ✕
            </button>
          </div>

          {/* 支出 / 收入 as one press, coloured the way the figures will be:
              money out is red and money in is green in every setting — these
              are status words, not market direction. */}
          <div role="group" aria-label={tr("quick.direction")} className="flex gap-2">
            {(["out", "in"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDirection(d);
                  setCategory("");
                }}
                aria-pressed={direction === d}
                className={
                  "flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition " +
                  (direction === d
                    ? d === "out"
                      ? "border-bad bg-bad-tint text-bad"
                      : "border-good bg-good-tint text-good"
                    : "border-rule text-ink-soft hover:text-ink")
                }
              >
                {tr(d === "out" ? "quick.expense" : "quick.income")}
              </button>
            ))}
          </div>

          {/* Whose money it is (PRD v3 §4.1). Chips, not a drop-down: the
              household is two or three names, and the answer is one press. */}
          {members.length > 0 && (
            <MemberPicker members={members} value={memberId} onChange={setMemberId} />
          )}

          {/* The amount is the one field the entry cannot exist without, so it
              is the one field that is large: no label between the reader and
              the number, just the unit they are writing in. */}
          <label className="flex items-baseline gap-2">
            <span className="tnum text-2xl text-ink-faint">{currency}</span>
            <input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={tr("quick.amount")}
              aria-label={tr("quick.amount")}
              className={
                "tnum w-full border-0 border-b-2 border-rule bg-transparent pb-1 " +
                "font-display text-3xl text-ink outline-none transition focus:border-brand"
              }
            />
          </label>

          <div>
            <div className="mb-2 text-xs text-ink-soft">{tr("quick.category")}</div>
            <div className="flex flex-wrap gap-2">
              {codes.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCategory(category === code ? "" : code)}
                  aria-pressed={category === code}
                  className={
                    "rounded-full border px-3 py-1.5 text-sm transition " +
                    (category === code
                      ? "border-brand bg-brand-tint text-brand"
                      : "border-hair text-ink-soft hover:border-rule hover:text-ink")
                  }
                >
                  {tOpt(`cash.category.${code}`) ?? code}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">{tr("quick.date")}</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass + " w-full"}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">{tr("quick.account")}</span>
              <select
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                className={inputClass + " w-full"}
              >
                <option value="">{tr("quick.accountAny")}</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">{tr("quick.counterparty")}</span>
              <input
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                className={inputClass + " w-full"}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">{tr("quick.note")}</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={inputClass + " w-full"}
              />
            </label>
          </div>

          {error && <p className="text-sm text-bad">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button className={btnClass + " flex-1"} disabled={busy}>
              {busy ? "…" : tr("quick.save")}
            </button>
            <CancelButton onClick={onClose} />
          </div>
        </form>
      </div>
    </div>
  );
}
