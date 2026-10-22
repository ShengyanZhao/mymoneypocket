import { useEffect, useState } from "react";
import {
  getForecast,
  getUpcomingBills,
  type CashForecast,
  type ForecastAccount,
  type UpcomingBill,
} from "../api/bills";
import { apiError, cardClass, compact, money } from "./ui";
import { useT } from "../i18n/index.ts";

/* 现金流预测 (PRD v3 §4.3): will any account run thin before the bills come.

   The curve is a projection and says so: every point is what the ledger's
   four voices add up to from today's projected balance, a bill whose sum
   nobody knows counts as nothing (its date appears in the calendar and is
   named in the caveat below the curve), and the holidays that decide a
   payday have their own reach. A day that takes an account below zero is
   shown as a GAP — with the movements that got it there and which account
   could cover it. A suggestion to move money; the app moves none. */

export default function ForecastCard() {
  const tr = useT();
  const [days, setDays] = useState(30);
  const [forecast, setForecast] = useState<CashForecast | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingBill[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  async function load() {
    setError(null);
    try {
      const [f, u] = await Promise.all([getForecast(days), getUpcomingBills(7)]);
      setForecast(f);
      setUpcoming(u);
    } catch (e) {
      setError(apiError(e, tr("common.backendDown")));
    }
  }

  if (error) return <p className="text-bad">{error}</p>;
  if (!forecast) return <p className="text-ink-soft">{tr("common.loading")}</p>;

  const fmt = money(forecast.base_currency);
  const big = compact(forecast.base_currency);
  const covers = forecast.calendar_covers as
    | { from?: string; to?: string; estimated_years?: number[] }
    | undefined;

  return (
    <section className={cardClass + " space-y-4 p-5"}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="font-display text-xl text-ink">{tr("forecast.title")}</h3>
        <div className="flex gap-1 text-sm">
          {[30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={
                "rounded-lg border px-2.5 py-1 transition " +
                (days === d
                  ? "border-brand bg-brand-tint text-brand"
                  : "border-hair text-ink-soft hover:border-rule hover:text-ink")
              }
            >
              {tr(d === 30 ? "forecast.days30" : "forecast.days90")}
            </button>
          ))}
        </div>
      </div>

      {forecast.gaps.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold text-bad">{tr("forecast.gapsTitle")}</h4>
          <ul className="mt-1.5 space-y-2">
            {forecast.gaps.slice(0, 3).map((g, i) => (
              <li key={i} className="text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-ink">{g.date}</span>
                  <span className="text-ink-soft">{g.institution_name}</span>
                  <span className="tnum text-bad">{tr("forecast.deficit", { amount: fmt.format(g.deficit) })}</span>
                  {g.days > 1 && (
                    <span className="text-xs text-ink-faint">{tr("forecast.span", { days: g.days })}</span>
                  )}
                </div>
                {g.causes.length > 0 && (
                  <div className="text-xs text-ink-faint">
                    {tr("forecast.causes", {
                      what: g.causes
                        .map((m) => `${m.name} ${m.direction === "out" ? "−" : "+"}${m.base_amount != null ? fmt.format(m.base_amount) : tr("bills.varies")}`)
                        .join("、"),
                    })}
                  </div>
                )}
                {g.cover.length > 0 && (
                  <div className="text-xs text-brand">
                    {tr("forecast.cover", {
                      account: g.cover[0].institution_name ?? "",
                      amount: fmt.format(Math.min(g.deficit, g.cover[0].surplus)),
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">{tr("forecast.noGaps")}</p>
      )}

      <Curve accounts={forecast.accounts} fmt={fmt} />

      <p className="text-xs text-ink-faint">
        {forecast.unpriced > 0 && tr("forecast.unpriced", { count: forecast.unpriced })}{" "}
        {covers?.to &&
          tr("bills.calendarCovers", {
            from: covers.from ?? "",
            to: covers.to,
            years: (covers.estimated_years ?? []).join("、"),
          })}
      </p>

      {upcoming.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-ink">{tr("forecast.upcomingTitle")}</h4>
          <ul className="mt-1.5 space-y-1">
            {upcoming.slice(0, 5).map((b, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="tnum text-ink-soft">
                  {b.days_until === 0 ? tr("forecast.today") : tr("forecast.daysUntil", { days: b.days_until })}
                </span>
                <span className="text-ink">{b.name}</span>
                <span className="tnum text-bad">
                  {b.base_amount != null ? `−${fmt.format(b.base_amount)}` : tr("bills.varies")}
                </span>
                <span className={b.enough ? "text-xs text-good" : "text-xs text-bad"}>
                  {b.stated
                    ? tr(b.enough ? "forecast.enough" : "forecast.notEnough", {
                        balance: big.format(b.balance_today),
                      })
                    : tr("bills.varies")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** The accounts' balances across the horizon, one line each. Deliberately
    plain: a projection is read for its shape and its thin days, not for the
    pixel between two days. The zero line is what a gap hangs from. */
function Curve({
  accounts,
  fmt,
}: {
  accounts: ForecastAccount[];
  fmt: ReturnType<typeof money>;
}) {
  const tr = useT();
  const series = accounts.filter((a) => a.points.length > 0);
  if (series.length === 0) return null;
  const values = series.flatMap((a) => a.points.map((p) => p.balance));
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const W = 560;
  const H = 140;
  const x = (i: number, n: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const y = (v: number) => H - ((v - lo) / span) * H;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label={tr("forecast.title")}>
        <line x1="0" y1={y(0)} x2={W} y2={y(0)} stroke="var(--color-rule)" strokeDasharray="4 4" />
        {series.map((a, s) => {
          const pts = a.points.map((p, i) => `${x(i, a.points.length)},${y(p.balance)}`).join(" ");
          return (
            <polyline
              key={a.institution_id}
              points={pts}
              fill="none"
              stroke={s === 0 ? "var(--color-chart-1)" : s === 1 ? "var(--color-chart-2)" : "var(--color-chart-3)"}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          );
        })}
        <text x="0" y={H + 14} fontSize="11" fill="var(--color-ink-faint)">
          {forecast_from(series)}
        </text>
        <text x={W} y={H + 14} fontSize="11" textAnchor="end" fill="var(--color-ink-faint)">
          {series[0].points[series[0].points.length - 1]?.date}
        </text>
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        {series.map((a, s) => (
          <span key={a.institution_id} className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 rounded"
              style={{
                background:
                  s === 0 ? "var(--color-chart-1)" : s === 1 ? "var(--color-chart-2)" : "var(--color-chart-3)",
              }}
            />
            {a.institution_name}
            <span className="tnum text-ink-faint">{fmt.format(a.start_balance)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function forecast_from(series: ForecastAccount[]): string {
  return series[0].points[0]?.date ?? "";
}
