import { useEffect, useState, type FormEvent } from "react";
import {
  createBill,
  deleteBill,
  getBills,
  getCalendar,
  updateBill,
  type BillScheduleRead,
  type CalendarPage,
} from "../api/bills";
import type { Institution } from "../api/institutions";
import { apiError, btnClass, inputClass, money, Section } from "./ui";
import { useT, type MessageKey } from "../i18n/index.ts";

/* 账单日历 (PRD v3 §4.3): the days money moves that a frequency cannot name.

   A recurring flow picks the day of its start month and repeats it; a bill
   knows things like "the 20th", "the last workday", "the school's own two
   months". The calendar below shows BOTH voices beside the entries already
   recorded and the plan's buys — one payment once, whichever voice said it
   (the forecast keeps the rule; see `app/forecasting.py`).

   A bill with no sum keeps its date and counts as nothing: a credit card's
   bill varies, and a guessed sum would be a number no ledger can trace. */

const KINDS = [
  "credit_card",
  "installment",
  "insurance",
  "tuition",
  "rent",
  "mortgage",
  "salary",
  "custom",
];

const SOURCE_KEYS: Record<string, MessageKey> = {
  flow: "bills.source.flow",
  bill: "bills.source.bill",
  entry: "bills.source.entry",
  transfer: "bills.source.transfer",
  pac: "bills.source.pac",
};

export default function Bills({ institutions }: { institutions: Institution[] }) {
  const tr = useT();
  const [bills, setBills] = useState<BillScheduleRead[]>([]);
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [page, setPage] = useState<CalendarPage | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // The form: everything a bill is, including the one rule that names its
  // day. `dueDay` empty means the last workday; the alternative is a radio
  // pair, because a bill has exactly one of the two and never both.
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [amount, setAmount] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [rule, setRule] = useState<"day" | "last_workday">("day");
  const [dueDay, setDueDay] = useState("20");
  const [everyMonth, setEveryMonth] = useState(true);
  const [months, setMonths] = useState("2,9");
  const [remindDays, setRemindDays] = useState("3");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void getCalendar(month)
      .then(setPage)
      .catch((e) => setError(apiError(e, tr("common.backendDown"))));
    setDay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setBills(await getBills());
    } catch (e) {
      setError(apiError(e, tr("common.backendDown")));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setEditId(null);
    setName("");
    setKind("");
    setDirection("out");
    setAmount("");
    setInstitutionId("");
    setRule("day");
    setDueDay("20");
    setEveryMonth(true);
    setMonths("2,9");
    setRemindDays("3");
  }

  function startEdit(b: BillScheduleRead) {
    setEditId(b.id);
    setName(b.name);
    setKind(b.kind ?? "");
    setDirection(b.direction as "out" | "in");
    setAmount(b.amount != null ? String(b.amount) : "");
    setInstitutionId(b.institution_id != null ? String(b.institution_id) : "");
    setRule(b.due_last_workday ? "last_workday" : "day");
    setDueDay(String(b.due_day ?? 20));
    setEveryMonth(!b.months || b.months.length === 0);
    setMonths((b.months ?? [2, 9]).join(","));
    setRemindDays(String(b.remind_days));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsedMonths = everyMonth
      ? null
      : months
          .split(/[,，\s]+/)
          .map((m) => Number(m))
          .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
    const payload = {
      name: name.trim(),
      kind: kind || null,
      direction,
      amount: amount.trim() === "" ? null : Number(amount),
      currency: null,
      institution_id: institutionId ? Number(institutionId) : null,
      member_id: null,
      due_day: rule === "day" ? Number(dueDay) : null,
      due_last_workday: rule === "last_workday",
      months: parsedMonths && parsedMonths.length ? parsedMonths : null,
      remind_days: Number(remindDays) || 0,
      start_date: null,
      end_date: null,
      note: null,
    };
    setSubmitting(true);
    setFormError(null);
    try {
      if (editId != null) await updateBill(editId, payload);
      else await createBill(payload);
      reset();
      await load();
      const fresh = await getCalendar(month);
      setPage(fresh);
    } catch (err) {
      setFormError(apiError(err, tr("common.saveFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(b: BillScheduleRead) {
    if (!window.confirm(tr("bills.deleteAsk", { name: b.name }))) return;
    try {
      await deleteBill(b.id);
      if (editId === b.id) reset();
      await load();
    } catch (err) {
      setFormError(apiError(err, tr("common.saveFailed")));
    }
  }

  if (loading) return <p className="text-ink-soft">{tr("common.loading")}</p>;
  if (error) return <p className="text-bad">{error}</p>;

  const fmt = money(page?.base_currency ?? "CNY");
  const covers = page?.calendar_covers as
    | { from?: string; to?: string; estimated_years?: number[] }
    | undefined;

  return (
    <Section title={tr("bills.title")} hint={tr("bills.hint")} note={tr("bills.note")}>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">{tr("bills.name")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass + " w-36"} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">{tr("bills.kind")}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass + " w-28"}>
            <option value="">{tr("bills.kindBlank")}</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {tr(`bills.kind.${k}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">{tr("quick.direction")}</span>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "out" | "in")}
            className={inputClass + " w-20"}
          >
            <option value="out">{tr("quick.expense")}</option>
            <option value="in">{tr("quick.income")}</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">{tr("quick.amount")}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={tr("bills.amountBlank")}
            title={tr("bills.amountHint")}
            className={inputClass + " w-28"}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">{tr("quick.account")}</span>
          <select
            value={institutionId}
            onChange={(e) => setInstitutionId(e.target.value)}
            className={inputClass + " w-32"}
          >
            <option value="">{tr("quick.accountAny")}</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex items-end gap-2">
          <legend className="mb-1 block text-xs text-ink-soft">{tr("bills.rule")}</legend>
          <label className="flex items-center gap-1 pb-2 text-sm text-ink-soft">
            <input
              type="radio"
              checked={rule === "day"}
              onChange={() => setRule("day")}
            />
            {tr("bills.ruleDay")}
          </label>
          <input
            type="number"
            min="1"
            max="31"
            disabled={rule !== "day"}
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            aria-label={tr("bills.dueDay")}
            className={inputClass + " w-16"}
          />
          <label className="flex items-center gap-1 pb-2 text-sm text-ink-soft">
            <input
              type="radio"
              checked={rule === "last_workday"}
              onChange={() => setRule("last_workday")}
            />
            {tr("bills.ruleLastWorkday")}
          </label>
        </fieldset>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">{tr("bills.months")}</span>
          <span className="flex items-center gap-2 pb-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={everyMonth}
              onChange={(e) => setEveryMonth(e.target.checked)}
            />
            {tr("bills.everyMonth")}
            {!everyMonth && (
              <input
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                placeholder="2,9"
                className={inputClass + " w-20"}
              />
            )}
          </span>
        </label>
        <button className={btnClass} disabled={submitting || !name.trim()}>
          {editId != null ? tr("common.save") : tr("bills.add")}
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

      {bills.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {bills.map((b) => (
            <li key={b.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium text-ink">{b.name}</span>
              <span className="text-ink-soft">
                {ruleWord(tr, b)}
                {b.amount != null
                  ? ` · ${b.direction === "out" ? "−" : "+"}${fmt.format(b.amount)}`
                  : ` · ${tr("bills.varies")}`}
                {b.institution_id != null &&
                  ` · ${institutions.find((i) => i.id === b.institution_id)?.name ?? ""}`}
              </span>
              <span className="ml-auto flex gap-2 text-ink-faint">
                <button onClick={() => startEdit(b)} className="transition hover:text-brand">
                  {tr("common.edit")}
                </button>
                <button onClick={() => void remove(b)} className="transition hover:text-bad">
                  {tr("common.delete")}
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">{tr("bills.empty")}</p>
      )}

      {/* The month itself: expected movements by day, from every voice. */}
      <div className="mt-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-ink">{tr("bills.calendarTitle")}</h4>
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label={tr("review.prev")}
            className="rounded px-2 py-1 text-ink-soft hover:text-ink"
          >
            ‹
          </button>
          <span className="tnum text-ink-soft">{month}</span>
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label={tr("review.next")}
            className="rounded px-2 py-1 text-ink-soft hover:text-ink"
          >
            ›
          </button>
        </div>
      </div>
      {page && (
        <>
          <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs">
            {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
              <div key={d} className="py-1 text-ink-faint">
                {d === "一" ? tr("bills.mon") : d === "二" ? tr("bills.tue") : d === "三" ? tr("bills.wed") : d === "四" ? tr("bills.thu") : d === "五" ? tr("bills.fri") : d === "六" ? tr("bills.sat") : tr("bills.sun")}
              </div>
            ))}
            {gridDays(month).map((d) => {
              const rows = d ? (page.days[d] ?? []) : [];
              const inflow = rows.some((m) => m.direction === "in");
              const outflow = rows.some((m) => m.direction === "out");
              return (
                <button
                  key={d ?? Math.random()}
                  disabled={!d}
                  onClick={() => setDay(d)}
                  className={
                    "min-h-12 rounded-lg border p-1 text-left transition " +
                    (d === day ? "border-brand bg-brand-tint" : "border-transparent hover:bg-tint")
                  }
                >
                  {d && (
                    <>
                      <span className="tnum text-ink-soft">{Number(d.slice(8))}</span>
                      <span className="mt-0.5 flex gap-0.5">
                        {outflow && <span className="h-1.5 w-1.5 rounded-full bg-bad" />}
                        {inflow && <span className="h-1.5 w-1.5 rounded-full bg-good" />}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            {tr("bills.pickDay")}
            {covers?.to && (
              <>
                {" "}
                {tr("bills.calendarCovers", {
                  from: covers.from ?? "",
                  to: covers.to,
                  years: (covers.estimated_years ?? []).join("、"),
                })}
              </>
            )}
          </p>
          {day && (
            <ul className="mt-2 space-y-1 border-l-2 border-hair pl-3 text-sm">
              {(page.days[day] ?? []).map((m, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-ink">{m.name}</span>
                  <span className="text-xs text-ink-faint">
                    {tr(SOURCE_KEYS[m.source] ?? "bills.source.flow")}
                    {m.institution_name ? ` · ${m.institution_name}` : ""}
                    {!m.stated ? ` · ${tr("bills.varies")}` : ""}
                  </span>
                  <span className={"tnum ml-auto " + (m.direction === "in" ? "text-good" : "text-bad")}>
                    {m.direction === "in" ? "+" : "−"}
                    {m.amount != null ? fmt.format(m.amount) : tr("bills.varies")}
                  </span>
                </li>
              ))}
              {(page.days[day] ?? []).length === 0 && (
                <li className="text-ink-soft">{tr("bills.dayEmpty")}</li>
              )}
            </ul>
          )}
        </>
      )}
    </Section>
  );
}

function ruleWord(tr: ReturnType<typeof useT>, b: BillScheduleRead): string {
  if (b.due_last_workday) return tr("bills.onLastWorkday");
  const months = b.months && b.months.length ? tr("bills.onMonths", { months: b.months.join("、") }) : "";
  return months + tr("bills.onDay", { day: b.due_day ?? 0 });
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

/** The month as a week-aligned grid of "YYYY-MM-DD" strings, Monday first
    (the order Chinese calendars print), with nulls for the padding days. */
export function gridDays(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const pad = (first.getUTCDay() + 6) % 7;
  const len = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array(pad).fill(null);
  for (let d = 1; d <= len; d++) {
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
