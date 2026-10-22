import { useEffect, useState, type FormEvent } from "react";
import {
  createBudget,
  deleteBudget,
  getBudgetOverview,
  updateBudget,
  type BudgetOverview,
} from "../api/budgets";
import { apiError, btnClass, inputClass, money, Section } from "./ui";
import { tOpt, useT } from "../i18n/index.ts";

/* 预算 (PRD v3 §4.2): what a month may reach, against what it has reached.

   A budget is a plan and spending is a fact — nothing here blocks a row.
   What it shows is the gap between them, said in the two forms a household
   actually uses it in: the share of the line gone (with the colour of
   trouble at 80% and at 100%), and the daily allowance the days left
   allow — "这个月每天还能花 182" is the question a budget exists to answer.

   Two levels, one vocabulary: a line for a category, and a line with no
   category for the household's ceiling (总预算). A line repeats from its
   month onward, or is one month's own adjustment (`repeat`). */

export default function Budgets() {
  const tr = useT();
  const [overview, setOverview] = useState<BudgetOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [repeat, setRepeat] = useState(true);
  const [rollover, setRollover] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setOverview(await getBudgetOverview());
    } catch (e) {
      setError(apiError(e, tr("common.backendDown")));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setEditId(null);
    setCategory("");
    setAmount("");
    setRepeat(true);
    setRollover(false);
  }

  function startEdit(s: {
    id: number;
    category: string | null;
    stated: number;
    repeat: boolean;
    rollover: boolean;
  }) {
    // The slice carries the line in force — the very row an edit edits. A
    // lookup by "which line looks like this one" could find its predecessor.
    setEditId(s.id);
    setCategory(s.category ?? "");
    setAmount(String(s.stated));
    setRepeat(s.repeat);
    setRollover(s.rollover);
    setFormError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) {
      setFormError(tr("budget.amountNeeded"));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const payload = {
      category: category || null,
      amount: value,
      repeat,
      rollover,
    };
    try {
      if (editId != null) {
        await updateBudget(editId, { amount: value, repeat, rollover });
      } else {
        // The CURRENT month is what a new line is for; repeating lines then
        // carry forward on their own. A month that already has this line is
        // an edit of it, and the button says so.
        await createBudget({ year_month: overview?.month ?? "", ...payload });
      }
      reset();
      await load();
    } catch (err) {
      setFormError(apiError(err, tr("common.saveFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(s: { id: number }) {
    if (!window.confirm(tr("budget.deleteAsk"))) return;
    try {
      await deleteBudget(s.id);
      if (editId === s.id) reset();
      await load();
    } catch (err) {
      setFormError(apiError(err, tr("common.saveFailed")));
    }
  }

  if (loading) return <p className="text-ink-soft">{tr("common.loading")}</p>;
  if (error) return <p className="text-bad">{error}</p>;

  const base = overview?.base_currency ?? "CNY";
  const fmt = money(base);

  return (
    <Section title={tr("budget.title")} hint={tr("budget.hint")} note={tr("budget.note")}>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">{tr("budget.category")}</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass + " w-36"}
          >
            <option value="">{tr("budget.total")}</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tOpt(`cash.category.${c}`) ?? c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">{tr("budget.amount")}</span>
          <input
            type="number"
            step="1"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass + " w-28"}
          />
        </label>
        <label className="flex items-center gap-1.5 pb-2.5 text-sm text-ink-soft">
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
          {tr("budget.everyMonth")}
        </label>
        <label className="flex items-center gap-1.5 pb-2.5 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={rollover}
            onChange={(e) => setRollover(e.target.checked)}
          />
          {tr("budget.rollover")}
        </label>
        <button className={btnClass} disabled={submitting || amount === ""}>
          {editId != null ? tr("common.save") : tr("budget.add")}
        </button>
        {editId != null && (
          <button
            type="button"
            onClick={reset}
            className="rounded-sm px-3 py-2 text-sm text-ink-soft hover:text-ink"
          >
            {tr("common.cancel")}
          </button>
        )}
      </form>
      {formError && <p className="text-sm text-bad">{formError}</p>}

      {overview && overview.slices.length > 0 ? (
        <ul className="mt-2 space-y-3">
          {overview.slices.map((s) => (
            <li key={s.category ?? "total"}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium text-ink">
                  {s.category ? (tOpt(`cash.category.${s.category}`) ?? s.category) : tr("budget.total")}
                  {!s.repeat && <span className="ml-2 text-xs text-ink-faint">{tr("budget.onetime")}</span>}
                  {s.carried > 0 && (
                    <span className="ml-2 text-xs text-ink-faint">
                      {tr("budget.carried", { amount: fmt.format(s.carried) })}
                    </span>
                  )}
                </span>
                <span className="tnum text-sm text-ink-soft">
                  {fmt.format(s.spent)} / {fmt.format(s.budget)}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-tint">
                <div
                  className={"h-full rounded-full " + barTone(s.ratio)}
                  style={{ width: `${Math.min(100, s.ratio * 100)}%` }}
                />
              </div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
                <span className={s.remaining < 0 ? "text-bad" : "text-ink-faint"}>
                  {s.remaining < 0
                    ? tr("budget.over", { amount: fmt.format(-s.remaining) })
                    : tr("budget.left", { amount: fmt.format(s.remaining) })}
                  {s.daily != null &&
                    (s.remaining < 0
                      ? ""
                      : " · " + tr("budget.daily", { amount: fmt.format(s.daily) }))}
                </span>
                <span className="flex gap-2">
                  <button
                    onClick={() => startEdit(s)}
                    className="text-ink-faint transition hover:text-brand"
                  >
                    {tr("common.edit")}
                  </button>
                  <button
                    onClick={() => void remove(s)}
                    className="text-ink-faint transition hover:text-bad"
                  >
                    {tr("common.delete")}
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">{tr("budget.empty")}</p>
      )}
    </Section>
  );
}

/** At 80% the bar turns amber, at 100% red: two colours of trouble and one
    of rest, in the order they arrive. */
function barTone(ratio: number): string {
  if (ratio >= 1) return "bg-bad";
  if (ratio >= 0.8) return "bg-warn";
  return "bg-good";
}

// The category words, from the same list the entry forms offer. Kept as a
// literal here because this form's list is its own scope: it names BUDGET
// lines, and a budget for "transfer" is not a thing.
const EXPENSE_CATEGORIES = [
  "dining",
  "transport",
  "shopping",
  "housing",
  "utilities",
  "telecom",
  "medical",
  "education",
  "entertainment",
  "travel",
  "insurance",
  "debt_payment",
  "gift",
  "social_security",
  "tax",
  "other",
];
