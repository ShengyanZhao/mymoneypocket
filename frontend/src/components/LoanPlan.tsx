import { useEffect, useState, type FormEvent } from "react";
import { getInstitutions, type Institution } from "../api/institutions";
import {
  createDecision,
  getLoanPlan,
  prepayCompare,
  type LoanPlanRead,
  type PrepayOption,
} from "../api/loans";
import { updateLiability, type Liability } from "../api/liabilities";
import { apiError, btnClass, compact, inputClass, money, Section } from "./ui";
import { useT, type MessageKey } from "../i18n/index.ts";

/* 负债 2.0 (PRD v3 §4.4): the loan's plan beside the bank's own balances.

   Three things live here and one rule binds them. The PLAN — a combined
   loan's parts, each with its rate and its own schedule (等额本息 or
   等额本金), summed into the payment the family actually makes. The
   RECONCILIATION — the plan's remaining against the balance the reader
   recorded, the difference named rather than left as a gap (it is usually a
   prepayment). And the QUESTION — what paying 200,000 early saves against
   what it would earn invested, answered as a card with both halves, never
   only the comfortable one.

   A plan is a projection and the balance is the anchor: nothing here
   rewrites a recorded balance, and saving the comparison moves nothing at
   all (it becomes a Decision — a kept question, not a transaction). */

type Part = {
  name: string;
  principal: number;
  rate: number;
  method: string;
  term_months: number;
  start_date: string;
  paid_periods: number;
};

const METHODS = ["annuity", "equal_principal"];

export default function LoanPlan({
  liability,
  onChanged,
}: {
  liability: Liability;
  onChanged: () => void;
}) {
  const tr = useT();
  const [plan, setPlan] = useState<LoanPlanRead | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // The editor: one row per part, and the account the payment leaves.
  const [editing, setEditing] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liability.id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [p, insts] = await Promise.all([
        getLoanPlan(liability.id).catch(() => null),
        getInstitutions(),
      ]);
      setPlan(p);
      setInstitutions(insts);
      const terms = (liability.terms ?? null) as unknown as
        | { parts?: Part[]; payment_institution_id?: number | null }
        | null;
      setParts(terms?.parts ?? []);
      setAccountId(String(terms?.payment_institution_id ?? ""));
    } catch (e) {
      setError(apiError(e, tr("common.backendDown")));
    } finally {
      setLoading(false);
    }
  }

  async function savePlan(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await updateLiability(liability.id, {
        name: liability.name,
        currency: liability.currency,
        terms: {
          parts: parts.map((p) => ({
            ...p,
            principal: Number(p.principal),
            rate: Number(p.rate) / 100,
            term_months: Number(p.term_months),
            paid_periods: Number(p.paid_periods) || 0,
          })),
          payment_institution_id: accountId ? Number(accountId) : null,
        },
      });
      setEditing(false);
      await load();
      onChanged();
    } catch (err) {
      setFormError(apiError(err, tr("common.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-ink-soft">{tr("common.loading")}</p>;
  if (error) return <p className="text-bad">{error}</p>;

  const fmt = money(liability.currency);
  const big = compact(liability.currency);
  // The plan endpoint speaks both rates of an instalment; its schema is a
  // free dict, so the shapes the block below prints are named here.
  const inst = plan?.installment as unknown as
    | {
        count: number;
        per_period: number;
        nominal_rate: number | null;
        effective_rate: number | null;
      }
    | null;

  return (
    <Section
      title={tr("loan.title")}
      hint={tr("loan.hint")}
      note={plan && plan.difference != null && plan.difference !== 0 ? tr("loan.reconcileNote") : undefined}
    >
      {plan ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label={tr("loan.monthly")} value={fmt.format(plan.monthly_payment)} />
            <Figure label={tr("loan.planRemaining")} value={big.format(plan.plan_remaining)} />
            <Figure
              label={tr("loan.stated")}
              value={plan.stated_balance != null ? big.format(plan.stated_balance) : tr("common.na")}
            />
            <Figure
              label={tr("loan.difference")}
              value={
                plan.difference == null
                  ? tr("common.na")
                  : fmt.format(Math.abs(plan.difference))
              }
              valueClass={plan.difference == null ? undefined : plan.difference >= 0 ? "text-good" : "text-warn"}
              note={
                plan.difference != null && plan.difference !== 0
                  ? tr(plan.difference > 0 ? "loan.diffMore" : "loan.diffLess")
                  : undefined
              }
            />
          </div>

          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-brand">{tr("loan.scheduleOpen")}</summary>
            <div className="mt-2 max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-soft">
                    <th className="py-1 pr-3">{tr("loan.colDate")}</th>
                    <th className="py-1 pr-3 text-right">{tr("loan.colPayment")}</th>
                    <th className="py-1 pr-3 text-right">{tr("loan.colPrincipal")}</th>
                    <th className="py-1 pr-3 text-right">{tr("loan.colInterest")}</th>
                    <th className="py-1 text-right">{tr("loan.colRemaining")}</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.schedule.map((row) => (
                    <tr key={row.date} className="border-t border-hair">
                      <td className="py-1 pr-3 tnum">{row.date}</td>
                      <td className="py-1 pr-3 text-right tnum">{fmt.format(row.payment)}</td>
                      <td className="py-1 pr-3 text-right tnum text-ink-soft">{fmt.format(row.principal)}</td>
                      <td className="py-1 pr-3 text-right tnum text-ink-soft">{fmt.format(row.interest)}</td>
                      <td className="py-1 text-right tnum text-ink-soft">{fmt.format(row.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <p className="mt-2 text-xs text-ink-faint">
            {plan.interest_by_year
              .map((y) => tr("loan.interestYear", { year: y.year, paid: fmt.format(y.paid), due: fmt.format(y.due) }))
              .join("；")}
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-soft">{tr("loan.noPlan")}</p>
      )}

      <button
        onClick={() => {
          setEditing(!editing);
          if (!editing && parts.length === 0) {
            setParts([
              {
                name: liability.name,
                principal: liability.latest_balance ?? 0,
                rate: liability.interest_rate ?? 0,
                method: "annuity",
                term_months: 240,
                start_date: new Date().toISOString().slice(0, 10),
                paid_periods: 0,
              },
            ]);
          }
        }}
        className="rounded-xl border border-brand px-3 py-1.5 text-sm text-brand transition hover:bg-brand-tint"
      >
        {editing ? tr("common.cancel") : plan ? tr("loan.editPlan") : tr("loan.addPlan")}
      </button>

      {editing && (
        <form onSubmit={savePlan} className="mt-3 space-y-3">
          {parts.map((p, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-xl bg-tint p-3">
              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">{tr("loan.partName")}</span>
                <input
                  value={p.name}
                  onChange={(e) => setParts(parts.map((q, j) => (j === i ? { ...q, name: e.target.value } : q)))}
                  className={inputClass + " w-28"}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">{tr("loan.principal")}</span>
                <input
                  type="number"
                  value={p.principal}
                  onChange={(e) => setParts(parts.map((q, j) => (j === i ? { ...q, principal: Number(e.target.value) } : q)))}
                  className={inputClass + " w-28"}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">{tr("loan.rate")}</span>
                <input
                  type="number"
                  step="0.01"
                  value={p.rate}
                  onChange={(e) => setParts(parts.map((q, j) => (j === i ? { ...q, rate: Number(e.target.value) } : q)))}
                  className={inputClass + " w-20"}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">{tr("loan.method")}</span>
                <select
                  value={p.method}
                  onChange={(e) => setParts(parts.map((q, j) => (j === i ? { ...q, method: e.target.value } : q)))}
                  className={inputClass + " w-28"}
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {tr((m === "annuity" ? "loan.methodAnnuity" : "loan.methodEqual") as MessageKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">{tr("loan.term")}</span>
                <input
                  type="number"
                  value={p.term_months}
                  onChange={(e) => setParts(parts.map((q, j) => (j === i ? { ...q, term_months: Number(e.target.value) } : q)))}
                  className={inputClass + " w-20"}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">{tr("loan.start")}</span>
                <input
                  type="date"
                  value={p.start_date}
                  onChange={(e) => setParts(parts.map((q, j) => (j === i ? { ...q, start_date: e.target.value } : q)))}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">{tr("loan.paid")}</span>
                <input
                  type="number"
                  value={p.paid_periods}
                  onChange={(e) => setParts(parts.map((q, j) => (j === i ? { ...q, paid_periods: Number(e.target.value) } : q)))}
                  className={inputClass + " w-20"}
                />
              </label>
              {parts.length > 1 && (
                <button
                  type="button"
                  onClick={() => setParts(parts.filter((_, j) => j !== i))}
                  className="pb-2 text-ink-faint hover:text-bad"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={() =>
                setParts([
                  ...parts,
                  {
                    name: tr("loan.partName"),
                    principal: 0,
                    rate: 0,
                    method: "annuity",
                    term_months: 240,
                    start_date: new Date().toISOString().slice(0, 10),
                    paid_periods: 0,
                  },
                ])
              }
              className="rounded-lg border border-hair px-3 py-2 text-sm text-ink-soft hover:border-rule hover:text-ink"
            >
              {tr("loan.addPart")}
            </button>
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">{tr("loan.account")}</span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className={inputClass + " w-36"}
              >
                <option value="">{tr("quick.accountAny")}</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <button className={btnClass} disabled={saving}>
              {saving ? "…" : tr("loan.savePlan")}
            </button>
          </div>
          {formError && <p className="text-sm text-bad">{formError}</p>}
        </form>
      )}

      {plan && <PrepayCard liabilityId={liability.id} currency={liability.currency} />}

      {inst && (
        <div className="mt-2 rounded-xl bg-tint p-3 text-sm">
          <div className="font-medium text-ink">
            {tr("inst.title")} · {tr("inst.count")}/{inst.count} ·{" "}
            {fmt.format(inst.per_period)}
          </div>
          <div className="mt-1 text-ink-soft">
            {tr("inst.nominal", { rate: pct(inst.nominal_rate) })} ·{" "}
            <strong className="text-bad">{tr("inst.real", { rate: pct(inst.effective_rate) })}</strong>
          </div>
          <p className="mt-1 text-xs text-ink-faint">{tr("inst.note")}</p>
        </div>
      )}
    </Section>
  );
}

/** The decision card: both halves of the question, side by side — the
    certain arithmetic of the saved interest, and the projection of the
    invested money with its range. Saving keeps the question and its two
    answers; it moves nothing. */
function PrepayCard({ liabilityId, currency }: { liabilityId: number; currency: string }) {
  const tr = useT();
  const [amount, setAmount] = useState("");
  const [ret, setRet] = useState("5");
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<PrepayOption[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fmt = money(currency);
  const big = compact(currency);

  async function calculate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const result = await prepayCompare(liabilityId, {
        amount: Number(amount),
        expected_return: Number(ret) / 100,
      });
      setOptions(result.options);
    } catch (err) {
      setError(apiError(err, tr("common.saveFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function keep() {
    if (!options) return;
    setBusy(true);
    try {
      await createDecision({
        kind: "prepay_mortgage",
        payload: { amount: Number(amount), expected_return: Number(ret) / 100, options },
      });
      setSaved(true);
    } catch (err) {
      setError(apiError(err, tr("common.saveFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-hair p-4">
      <h4 className="text-sm font-semibold text-ink">{tr("prepay.title")}</h4>
      <form onSubmit={calculate} className="mt-2 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">{tr("prepay.amount")}</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass + " w-32"}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">{tr("prepay.return")}</span>
          <input
            type="number"
            step="0.1"
            value={ret}
            onChange={(e) => setRet(e.target.value)}
            className={inputClass + " w-20"}
          />
        </label>
        <button className={btnClass} disabled={busy || !amount}>
          {busy ? "…" : tr("prepay.calc")}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      {options && (
        <div className="mt-3 space-y-2">
          {options.map((o) => (
            <div key={o.mode} className="rounded-lg bg-tint p-3 text-sm">
              <div className="font-medium text-ink">
                {tr(o.mode === "shorten" ? "prepay.shorten" : "prepay.reduce")}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-ink-soft">
                <span className="tnum">{tr("prepay.saved", { amount: fmt.format(o.saved_interest) })}</span>
                {o.mode === "shorten" ? (
                  <span className="tnum">{tr("prepay.monthsSaved", { months: o.months_saved })}</span>
                ) : (
                  <span className="tnum">
                    {tr("prepay.payChange", {
                      old: fmt.format(o.old_payment),
                      new: fmt.format(o.new_payment),
                    })}
                  </span>
                )}
              </div>
            </div>
          ))}
          {options[0] && (
            <p className="text-xs text-ink-faint">
              {tr("prepay.invest", {
                rate: pct(options[0].expected_return),
                value: big.format(options[0].invested_value),
                lo: big.format(options[0].invested_range[0]),
                hi: big.format(options[0].invested_range[1]),
              })}
            </p>
          )}
          <button
            onClick={() => void keep()}
            disabled={busy || saved}
            className="rounded-xl border border-brand px-3 py-1.5 text-sm text-brand transition hover:bg-brand-tint"
          >
            {saved ? tr("prepay.kept") : tr("prepay.keep")}
          </button>
        </div>
      )}
    </div>
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

function pct(rate: number | null | undefined): string {
  return rate == null ? "—" : `${(rate * 100).toFixed(1)}%`;
}
