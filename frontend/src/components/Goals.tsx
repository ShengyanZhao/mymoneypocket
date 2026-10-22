import { Fragment, useEffect, useState, type FormEvent } from "react";
import {
  computeRequiredReturn,
  createGoal,
  deleteGoal,
  getGoals,
  updateGoal,
  type Goal,
  type RequiredReturnResult,
} from "../api/goals";
import { getBaseCurrency } from "../api/baseCurrency";
import {
  Row,
  RowsOrEmpty,
  Section,
  apiError,
  btnClass,
  inputClass,
  money,
  CURRENCY_LIST,
} from "./ui";
import { goal, marks, refusal } from "./required";
import { tOpt, useT } from "../i18n/index.ts";

/* The dropdown's six kinds of goal. `value` is what is stored and what the
   form compares against, and it never moves; `label` is the English the page
   used to show and still SENDS as the goal's name when the detail box is
   empty; `labelKey` is what the page SHOWS. The two are kept apart on
   purpose: a stored name is a fact, and it stays in the language it was
   written in whatever the page is speaking today. */
const GOAL_TYPES: { value: string; label: string; labelKey: string }[] = [
  {
    value: "protect_inflation",
    label: "Protect from inflation",
    labelKey: "goals.type.protect_inflation",
  },
  {
    value: "stable_income",
    label: "Stable / passive income",
    labelKey: "goals.type.stable_income",
  },
  {
    value: "long_term_growth",
    label: "Long-term growth",
    labelKey: "goals.type.long_term_growth",
  },
  { value: "emergency_fund", label: "Emergency fund", labelKey: "goals.type.emergency_fund" },
  {
    value: "target_amount",
    label: "Target amount by a date",
    labelKey: "goals.type.target_amount",
  },
  {
    value: "other",
    label: "Something else (describe it)",
    labelKey: "goals.type.other",
  },
];

/** The English label: what an empty name is stored as, and what a stored name
    is compared against to decide whether it says anything the type has not. */
function englishTypeLabel(value: string | null): string | null {
  return GOAL_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** The same label, said in the language in force, for the page alone.
    `tOpt` rather than `tr` because the key is picked at runtime, and a goal
    type nobody has translated yet should read as its English label rather
    than as a key. The caller has `useT()`, so a language switch re-renders
    into the new words. */
function typeLabel(value: string | null): string | null {
  const found = GOAL_TYPES.find((t) => t.value === value);
  return found ? tOpt(found.labelKey) ?? found.label : value;
}

/* The backend's realism note under a required return. Six sentences, a closed
   set (`planning.assess`), so each is named here rather than shown in the
   backend's English beside a translated sentence. */
const ASSESS_KEY: Record<string, string> = {
  "The target date is in the past.": "goals.assess.pastDate",
  "Target effectively unreachable with these contributions. Raise contributions or extend the horizon.":
    "goals.assess.unreachable",
  "Already on track without investment growth.": "goals.assess.onTrack",
  "Conservative: feasible with a low-risk allocation.": "goals.assess.conservative",
  "Moderate: in line with a diversified long-term portfolio.": "goals.assess.moderate",
  "Aggressive: high risk, not guaranteed.": "goals.assess.aggressive",
  "Unrealistic: consider extending the horizon, raising contributions, or lowering the target.":
    "goals.assess.unrealistic",
};

function assessmentWords(assessment: string): string {
  return tOpt(ASSESS_KEY[assessment] ?? "") ?? assessment;
}

export default function Goals() {
  const tr = useT();
  const [items, setItems] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [monthly, setMonthly] = useState("");
  /* A goal belongs to no account: its currency is proposed from the base the
     reader chose, and what they type in the box wins. An edited goal keeps its
     own. */
  const [base, setBase] = useState("");
  const [currencyChoice, setCurrencyChoice] = useState<string | null>(null);
  const currency = currencyChoice ?? base;
  const [submitting, setSubmitting] = useState(false);

  const [rr, setRr] = useState<RequiredReturnResult | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [goals, b] = await Promise.all([getGoals(), getBaseCurrency()]);
      setItems(goals);
      setBase(b.base_currency);
    } catch (err) {
      setError(apiError(err, tr("common.backendDown")));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (type !== "target_amount" || !targetAmount || !targetDate) {
      setRr(null);
      return;
    }
    let cancelled = false;
    computeRequiredReturn({
      current_amount: Number(currentAmount) || 0,
      monthly_contribution: Number(monthly) || 0,
      target_amount: Number(targetAmount),
      target_date: targetDate,
    })
      .then((res) => !cancelled && setRr(res))
      .catch(() => !cancelled && setRr(null));
    return () => {
      cancelled = true;
    };
  }, [type, targetAmount, targetDate, currentAmount, monthly]);

  const isTarget = type === "target_amount";

  function reset() {
    setEditId(null);
    setName("");
    setType("");
    setTargetAmount("");
    setTargetDate("");
    setCurrentAmount("");
    setMonthly("");
    setCurrencyChoice(null);
  }

  function startEdit(g: Goal) {
    setEditId(g.id);
    setName(g.name);
    setType(g.type ?? "");
    setTargetAmount(g.target_amount != null ? String(g.target_amount) : "");
    setTargetDate(g.target_date ?? "");
    setCurrentAmount(g.current_amount != null ? String(g.current_amount) : "");
    setMonthly(g.monthly_contribution != null ? String(g.monthly_contribution) : "");
    setCurrencyChoice(g.currency);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    // The dropdown carries the meaning; a free label like "get rich" adds
    // nothing, so it is optional — except for "other", where it IS the goal.
    const refused = refusal(goal(type), { type, name, currency });
    if (refused) {
      setError(refused);
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload = {
      // The English label, not the one on screen: what is stored is a fact in
      // the language it was written in, and a page that switched language
      // should not rewrite it.
      name: name.trim() || (englishTypeLabel(type) ?? type),
      type,
      currency: currency.trim(),
      target_amount: isTarget && targetAmount ? Number(targetAmount) : null,
      target_date: isTarget && targetDate ? targetDate : null,
      current_amount: isTarget && currentAmount ? Number(currentAmount) : null,
      monthly_contribution: isTarget && monthly ? Number(monthly) : null,
    };
    try {
      if (editId != null) await updateGoal(editId, payload);
      else await createGoal(payload);
      reset();
      await load();
    } catch (err) {
      setError(apiError(err, tr("common.saveFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(g: Goal) {
    if (!window.confirm(tr("goals.deleteConfirm", { name: g.name }))) return;
    setError(null);
    try {
      await deleteGoal(g.id);
      if (editId === g.id) reset();
      await load();
    } catch (err) {
      setError(apiError(err, tr("goals.deleteFailed")));
    }
  }

  function goalSubtitle(g: Goal): string | undefined {
    if (g.type === "target_amount" && g.target_amount && g.target_date) {
      return tr("goals.targetSubtitle", {
        amount: money(g.currency).format(g.target_amount),
        date: g.target_date,
      });
    }
    return undefined;
  }

  if (loading) return <p className="text-ink-soft">{tr("common.loading")}</p>;

  return (
    <Section title={tr("goals.title")} hint={tr("goals.hint")}>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <select className={inputClass} {...marks(goal(type), "type")} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{tr("goals.typePlaceholder")}</option>
            {GOAL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{typeLabel(t.value)}</option>
            ))}
          </select>
          <input
            className={inputClass + " min-w-64 flex-1"}
            placeholder={tr("goals.detailPlaceholder")}
            {...marks(goal(type), "name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {isTarget && (
          <div className="flex flex-wrap items-center gap-2">
            <input className={inputClass + " w-36"} type="number" step="0.01" placeholder={tr("goals.targetPlaceholder")} value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
            <input className={inputClass} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            <input className={inputClass + " w-36"} type="number" step="0.01" placeholder={tr("goals.currentPlaceholder")} value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)} />
            <input className={inputClass + " w-40"} type="number" step="0.01" placeholder={tr("goals.monthlyPlaceholder")} value={monthly} onChange={(e) => setMonthly(e.target.value)} />
            <input
              className={inputClass + " w-20"}
              placeholder={tr("goals.currencyPlaceholder")}
              {...marks(goal(type), "currency")}
              list={CURRENCY_LIST}
              title={tr("goals.currencyTitle")}
              value={currency}
              onChange={(e) => setCurrencyChoice(e.target.value)}
            />
          </div>
        )}

        {rr && <RequiredReturnNote rr={rr} />}

        <div className="flex items-center gap-2">
          <button className={btnClass} disabled={submitting}>{submitting ? "..." : editId != null ? tr("goals.save") : tr("goals.add")}</button>
          {editId != null && (
            <button type="button" onClick={reset} className="rounded-sm px-3 py-2 text-sm text-ink-soft hover:text-ink">
              {tr("common.cancel")}
            </button>
          )}
        </div>
      </form>

      {error && <p className="text-bad">{error}</p>}

      <RowsOrEmpty loading={false} error={null} empty={items.length === 0} emptyText={tr("goals.empty")}>
        {items.map((g) => (
          <Row
            key={g.id}
            onEdit={() => startEdit(g)}
            onDelete={() => remove(g)}
            title={typeLabel(g.type) ?? g.name}
            subtitle={[g.name !== englishTypeLabel(g.type) ? g.name : null, goalSubtitle(g)]
              .filter(Boolean)
              .join(" · ") || undefined}
            note={g.notes}
            value={g.type === "target_amount" && g.target_amount ? money(g.currency).format(g.target_amount) : undefined}
          />
        ))}
      </RowsOrEmpty>
    </Section>
  );
}

function RequiredReturnNote({ rr }: { rr: RequiredReturnResult }) {
  const tr = useT();
  const r = rr.required_annual_return;
  const tone =
    r === null || r > 0.12
      ? "bg-bad-tint text-bad"
      : r > 0.08
        ? "bg-warn-tint text-warn"
        : "bg-good-tint text-good";
  const rate =
    r === null
      ? tr("goals.rateUnreachable")
      : tr("goals.ratePerYear", { pct: (r * 100).toFixed(1) });
  return (
    <p className={"rounded-sm p-3 text-sm " + tone}>
      {/* `**{rate}**` lives in the catalogue, so the translation can move the
          emphasis to where its language wants it instead of the JSX deciding. */}
      {tr
        .rich("goals.requiredReturn", {
          years: rr.years,
          rate,
          assessment: assessmentWords(rr.assessment),
        })
        .map((part, i) =>
          part.kind === "strong" ? (
            <strong key={i}>{part.value}</strong>
          ) : part.kind === "em" ? (
            <em key={i}>{part.value}</em>
          ) : (
            <Fragment key={i}>{part.value}</Fragment>
          ),
        )}
    </p>
  );
}
