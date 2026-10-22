import { useEffect, useState } from "react";
import {
  getBudgetOverview,
  getMonthReview,
  resolveSuggestion,
  type BudgetOverview,
  type MonthReviewRead,
  type ReviewMover,
  type ReviewSuggestion,
} from "../api/budgets";
import { getCashEntries, type CashEntryRead } from "../api/imports";
import { apiError, cardClass, compact, money } from "./ui";
import { tOpt, useT } from "../i18n/index.ts";

/* 月度复盘 (PRD v3 §4.2): what a month did, and what to look at first.

   The numbers arrive computed from the ledger (`GET /api/reviews`), so this
   card cannot disagree with the rows — and where it says a category moved,
   the rows behind the sentence are one press away (`entry_ids`): an
   attribution and its evidence are shown together, never one without the
   other. Suggestions are at most three and each is one decision: take it
   into next month's budget, or dismiss it and stop seeing it.

   The month is chosen here; the CURRENT month's review is the one that
   opens, because a household reads itself at month end and the current
   month is where that reading starts. */

export default function Review({ onAskAi }: { onAskAi: (seed: string) => void }) {
  const tr = useT();
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [review, setReview] = useState<MonthReviewRead | null>(null);
  const [overview, setOverview] = useState<BudgetOverview | null>(null);
  const [entries, setEntries] = useState<CashEntryRead[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function load() {
    setError(null);
    try {
      const [rv, ov, es] = await Promise.all([
        getMonthReview(month),
        getBudgetOverview(month),
        getCashEntries(),
      ]);
      setReview(rv);
      setOverview(ov);
      setEntries(es);
    } catch (e) {
      setError(apiError(e, tr("common.backendDown")));
    }
  }

  async function decide(s: ReviewSuggestion, action: "accepted" | "ignored") {
    setBusy(s.key);
    setError(null);
    try {
      await resolveSuggestion({
        year_month: month,
        key: s.key,
        action,
        amount: action === "accepted" ? s.proposed_amount : null,
      });
      await load();
    } catch (e) {
      setError(apiError(e, tr("common.saveFailed")));
    } finally {
      setBusy(null);
    }
  }

  if (error) return <p className="text-bad">{error}</p>;
  if (!review) return <p className="text-ink-soft">{tr("common.loading")}</p>;

  const fmt = money(review.base_currency);
  const big = compact(review.base_currency);
  const category = (c: string | null) => (c ? (tOpt(`cash.category.${c}`) ?? c) : tr("budget.total"));
  const expenseDelta = review.expenses - review.prev_expenses;
  const expensePct =
    review.prev_expenses > 0 ? expenseDelta / review.prev_expenses : null;

  const seed = tr("review.seed", {
    month: review.month,
    expenses: fmt.format(review.expenses),
    change:
      expensePct == null
        ? tr("review.seedNoPrev")
        : tr("review.seedChange", {
            pct: `${expensePct > 0 ? "+" : ""}${Math.round(expensePct * 100)}%`,
          }),
    movers: review.movers
      .map((m) => tr("review.seedMover", { category: category(m.category), delta: fmt.format(m.delta) }))
      .join("、"),
  });

  return (
    <section className={cardClass + " space-y-5 p-5"}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="font-display text-xl text-ink">{tr("review.title", { month: review.month })}</h3>
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={() => setMonth(shift(review.month, -1))}
            aria-label={tr("review.prev")}
            className="rounded px-2 py-1 text-ink-soft hover:text-ink"
          >
            ‹
          </button>
          <span className="tnum text-ink-soft">{review.month}</span>
          <button
            onClick={() => setMonth(shift(review.month, 1))}
            aria-label={tr("review.next")}
            disabled={review.month >= currentMonth()}
            className="rounded px-2 py-1 text-ink-soft hover:text-ink disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      {/* The totals, each beside the month before it. A spending change is a
          STATE (rose is worth attention) and stays red/green in every
          setting; the net worth change is a market direction and follows
          涨跌配色. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Figure label={tr("review.expenses")} value={big.format(review.expenses)} />
        <Figure
          label={tr("review.vsPrev", { month: review.prev_month })}
          value={expensePct == null ? tr("common.na") : `${expensePct > 0 ? "+" : ""}${Math.round(expensePct * 100)}%`}
          valueClass={expenseDelta > 0 ? "text-bad" : "text-good"}
        />
        <Figure label={tr("dashboard.savingsRate")} value={review.savings_rate == null ? tr("common.na") : `${Math.round(review.savings_rate * 100)}%`} />
        <Figure
          label={tr("dashboard.netWorth")}
          value={big.format(review.net_worth)}
          note={tr("review.netWorthNote", {
            amount: fmt.format(review.net_worth - review.prev_net_worth),
          })}
        />
      </div>
      <p className="text-xs text-ink-faint">
        {tr("review.mix", {
          fixed: fmt.format(review.fixed_total),
          flexible: fmt.format(review.flexible_total),
        })}{" "}
        {tr("review.entriesNote", { count: review.entry_count, days: review.days_with_entries })}
      </p>

      {overview && overview.total_budget > 0 && (
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-ink">{tr("review.budgetTitle")}</span>
            <span className="tnum text-ink-soft">
              {fmt.format(overview.total_spent)} / {fmt.format(overview.total_budget)}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-tint">
            <div
              className={
                "h-full rounded-full " +
                (overview.total_spent >= overview.total_budget
                  ? "bg-bad"
                  : overview.total_spent >= overview.total_budget * 0.8
                    ? "bg-warn"
                    : "bg-good")
              }
              style={{
                width: `${Math.min(100, (overview.total_spent / overview.total_budget) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {review.movers.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-ink">{tr("review.moversTitle")}</h4>
          <ul className="mt-2 space-y-2">
            {review.movers.map((m) => (
              <MoverLine
                key={m.category ?? "total"}
                mover={m}
                category={category(m.category)}
                fmt={fmt}
                expanded={expanded === (m.category ?? "total")}
                onToggle={() =>
                  setExpanded(expanded === (m.category ?? "total") ? null : (m.category ?? "total"))
                }
                entries={entries}
              />
            ))}
          </ul>
        </div>
      )}

      {review.suggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-ink">{tr("review.suggestionsTitle")}</h4>
          <ul className="mt-2 space-y-2">
            {review.suggestions.map((s) => (
              <li key={s.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-ink">{suggestionText(tr, s, category, fmt)}</span>
                <span className="ml-auto flex gap-2">
                  <button
                    onClick={() => void decide(s, "accepted")}
                    disabled={busy === s.key}
                    className="rounded-lg border border-brand px-2.5 py-1 text-brand transition hover:bg-brand-tint"
                  >
                    {tr("review.accept")}
                  </button>
                  <button
                    onClick={() => void decide(s, "ignored")}
                    disabled={busy === s.key}
                    className="rounded-lg border border-hair px-2.5 py-1 text-ink-soft transition hover:border-rule hover:text-ink"
                  >
                    {tr("review.ignore")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() => onAskAi(seed)}
        className="rounded-xl border border-brand px-4 py-2 text-sm font-medium text-brand transition hover:bg-brand-tint"
      >
        {tr("review.askAi")}
      </button>
    </section>
  );
}

function Figure({
  label,
  value,
  valueClass,
  note,
}: {
  label: string;
  value: string;
  valueClass?: string;
  note?: string;
}) {
  return (
    <div>
      <div className="text-xs text-ink-soft">{label}</div>
      <div className={"tnum text-xl font-semibold " + (valueClass ?? "text-ink")}>{value}</div>
      {note && <div className="text-xs text-ink-faint">{note}</div>}
    </div>
  );
}

/* One line of "what moved most", with its evidence behind it. The press
   opens the very rows the sentence was made of — the acceptance criterion,
   and the only way an attribution stays honest. */
function MoverLine({
  mover,
  category,
  fmt,
  expanded,
  onToggle,
  entries,
}: {
  mover: ReviewMover;
  category: string;
  fmt: ReturnType<typeof money>;
  expanded: boolean;
  onToggle: () => void;
  entries: CashEntryRead[];
}) {
  const tr = useT();
  const rows = entries.filter((e) => mover.entry_ids.includes(e.id));
  return (
    <li>
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium text-ink">{category}</span>
        <span className="tnum text-bad">+{fmt.format(mover.delta)}</span>
        {mover.reason_counterparty && (
          <span className="text-ink-soft">
            {tr("review.reason", {
              party: mover.reason_counterparty,
              count: mover.reason_count,
            })}
          </span>
        )}
        <button onClick={onToggle} className="ml-auto text-xs text-brand underline">
          {tr("review.showRows", { count: mover.entry_ids.length })}
        </button>
      </div>
      {expanded && (
        <ul className="mt-1 space-y-0.5 border-l-2 border-hair pl-3 text-xs text-ink-soft">
          {rows.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-2">
              <span className="tnum">{e.date}</span>
              <span>{e.counterparty ?? tr("review.noParty")}</span>
              <span className="tnum ml-auto">
                {e.direction === "out" ? "−" : "+"}
                {fmt.format(e.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function suggestionText(
  tr: ReturnType<typeof useT>,
  s: ReviewSuggestion,
  category: (c: string | null) => string,
  fmt: ReturnType<typeof money>,
): string {
  if (s.kind === "raise")
    return tr("review.suggestRaise", {
      category: category(s.category),
      amount: fmt.format(s.proposed_amount ?? 0),
    });
  if (s.kind === "lower")
    return tr("review.suggestLower", {
      category: category(s.category),
      amount: fmt.format(s.proposed_amount ?? 0),
    });
  return tr("review.suggestCategorize");
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function shift(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}
