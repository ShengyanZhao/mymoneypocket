import { Fragment, useEffect, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getAllocation,
  getNetWorthSeries,
  getSummary,
  type DashboardAllocation,
  type DashboardSummary,
  type NetWorthPoint,
} from "../api/dashboard";
import { getCashFlowSummary, type CashFlowSummary } from "../api/cashflow";
import { EmptyState } from "./Emblem";
import { inForceIntro, notCounted, undatedLine } from "./inForce";
import { OmissionsNotice } from "./OmissionsNotice";
import { UnconvertedNotice } from "./UnconvertedNotice";
import { Explainer, savingsRate, StatCard, apiError, cardClass, locale, money, statLabelClass } from "./ui";
import { t, tOpt, useT } from "../i18n/index.ts";
import type { Money } from "./money";

/* Chart decisions (see the project's dataviz rules):
   - Net worth over time is ONE series: the headline metric. The components
     (financial / real / debts) live in the hover layer instead of becoming
     three more lines that bury the story — "emphasis", not "categorical".
     A single series needs no legend: the title names it.
   - Allocation is nominal (asset classes have no natural order), so every bar
     takes the SAME hue. Colouring bars by size would re-encode bar length.
   - Savings rate is a ratio against a target -> a meter, not a chart.
   - Grid and axes are solid hairlines, never dashed. */

/* Two formatters, built per call rather than once at module load.

   They used to be `const` built from `locale` at import time, which is right
   for a language that cannot change and wrong for one that can: after a
   switch the chart would still write English month names beside Chinese
   headings. `Intl.NumberFormat` is not free to construct, but these are asked
   for a handful of times per render — cheap enough to buy correctness. */
function pctFmt(): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  });
}

function compactFmt(): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, { notation: "compact" });
}

/** "fund_etf" -> "Fund Etf", "real_estate" -> "Real Estate".

    A code the catalogue has named is said by its name instead: the backend
    sends identifiers, and an identifier spelled out with spaces in it is what
    a reader sees when nobody has translated it yet. */
function prettyLabel(s: string): string {
  return (
    tOpt(`code.${s}`) ??
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function fmtDay(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
}

function fmtFull(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** A chart and its table twin: every value stays reachable without hovering. */
function ChartCard({
  title,
  subtitle,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  table: ReactNode;
  children: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const tr = useT();
  const views: { key: "chart" | "table"; labelKey: Parameters<typeof tr>[0] }[] = [
    { key: "chart", labelKey: "dashboard.chart" },
    { key: "table", labelKey: "dashboard.table" },
  ];
  return (
    <section className={cardClass + " p-5"}>
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-xl leading-tight text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 gap-3 text-[0.65rem] uppercase tracking-wider">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              aria-pressed={view === v.key}
              className={
                "border-b transition " +
                (view === v.key
                  ? "border-olive font-semibold text-ink"
                  : "border-transparent text-ink-soft hover:text-ink")
              }
            >
              {tr(v.labelKey)}
            </button>
          ))}
        </div>
      </header>
      {view === "chart" ? children : <div className="overflow-x-auto">{table}</div>}
    </section>
  );
}

type TipProps = {
  active?: boolean;
  label?: string | number;
  payload?: { payload: NetWorthPoint }[];
};

/** Hover detail for the net-worth series: the breakdown the chart deliberately
    does not draw as extra lines. */
function SeriesTooltip({ active, payload, label }: TipProps) {
  const tr = useT();
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const rows: [string, number][] = [
    [tr("dashboard.netWorth"), p.net_worth],
    [tr("dashboard.financial"), p.financial],
    [tr("dashboard.realAssets"), p.real],
    [tr("dashboard.debts"), p.liabilities],
  ];
  return (
    <div className="rounded-sm border border-rule bg-surface px-3 py-2 text-xs">
      <div className="mb-1.5 font-medium text-ink">{fmtFull(String(label))}</div>
      <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        {rows.map(([k, v], i) => (
          <Fragment key={k}>
            <dt className="text-ink-soft">{k}</dt>
            <dd
              className={
                "text-right tabular-nums " + (i === 0 ? "font-semibold text-ink" : "text-ink-soft")
              }
            >
              {money(p.base_currency).format(v)}
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}

/** Ranked bars in plain HTML: labels can never be clipped by a mark, and the
    bar keeps its 4px rounded data-end with a square baseline. */
function RankedBars({
  items,
  total,
  unit,
}: {
  items: { name: string; value: number }[];
  total: number;
  /** The allocation's base, as its payload declared it. */
  unit: Money;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {items.map((it) => (
        <div
          key={it.name}
          className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_auto]"
        >
          <span className="truncate text-ink" title={it.name}>
            {it.name}
          </span>
          <div className="h-3 bg-tint">
            <div
              className="h-3 rounded-r-[4px] bg-olive"
              style={{ width: `${Math.max((it.value / max) * 100, 1)}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-right tabular-nums text-ink-soft">
            {unit.format(it.value)}
            <span className="ml-1.5 text-ink-faint">
              {total ? pctFmt().format(it.value / total) : t("common.na")}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Savings-rate meter: the track is a lighter step of the fill's own ramp, so
    the state reads across the whole bar. */
function Meter({ ratio }: { ratio: number | null }) {
  const tr = useT();
  // Named as the Cash flow page names it, with its definition behind the "?";
  // it used to be captioned by the definition alone, under no name.
  const name = (
    <div className="flex items-center gap-2">
      <div className={statLabelClass}>{tr("dashboard.savingsRate")}</div>
      <Explainer {...savingsRate()} />
    </div>
  );
  if (ratio == null)
    return (
      <div className="space-y-1.5">
        {name}
        <p className="text-sm text-ink-soft">{tr("dashboard.savingsRateNone")}</p>
      </div>
    );
  const clamped = Math.max(0, Math.min(ratio, 1));
  const tone = ratio < 0 ? "bg-down" : ratio < 0.1 ? "bg-warn" : "bg-olive";
  const label =
    ratio < 0
      ? tr("dashboard.savingsRateDown")
      : ratio < 0.1
        ? tr("dashboard.savingsRateThin")
        : tr("dashboard.savingsRateHealthy");
  return (
    <div className="space-y-1.5">
      {name}
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-3xl leading-none text-ink">
          {pctFmt().format(ratio)}
        </span>
        <span className="text-xs text-ink-soft">{label}</span>
      </div>
      <div className="h-2.5 bg-olive-tint">
        <div className={"h-2.5 rounded-r-[4px] " + tone} style={{ width: `${clamped * 100}%` }} />
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={cardClass + " p-5"}>
      <h3 className="mb-5 font-display text-xl leading-tight text-ink">{title}</h3>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const tr = useT();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [allocation, setAllocation] = useState<DashboardAllocation | null>(null);
  const [series, setSeries] = useState<NetWorthPoint[]>([]);
  const [cash, setCash] = useState<CashFlowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, a, n, c] = await Promise.all([
        getSummary(),
        getAllocation(),
        getNetWorthSeries(),
        getCashFlowSummary(),
      ]);
      setSummary(s);
      setAllocation(a);
      setSeries(n);
      setCash(c);
    } catch (err) {
      setError(apiError(err, t("dashboard.loadError")));
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p className="text-ink-soft">{tr("common.loading")}</p>;
  if (error) return <p className="text-down">{error}</p>;
  if (!summary || !allocation) return null;
  // Each figure in the unit of the payload it came in.
  const inSummary = money(summary.base_currency);
  const inAllocation = money(allocation.base_currency);

  const allocationItems = [
    ...allocation.by_asset_class.map((s) => ({
      name: prettyLabel(s.asset_class),
      value: s.value,
    })),
    ...allocation.by_real_category.map((s) => ({
      name: prettyLabel(s.category),
      value: s.value,
    })),
  ]
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value);
  const allocationTotal = allocationItems.reduce((acc, i) => acc + i.value, 0);

  const first = series[0];
  const last = series[series.length - 1];
  const delta = series.length > 1 ? last.net_worth - first.net_worth : null;
  const hasData = summary.net_worth !== 0 || series.length > 0;

  return (
    <div className="space-y-10">
      {/* Hero figure + the components it is made of. */}
      <section className="space-y-7">
        <div>
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-ink-soft">
            {tr("dashboard.netWorth")}
          </p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span className="font-display text-5xl leading-none text-ink sm:text-6xl">
              {inSummary.format(summary.net_worth)}
            </span>
            {delta != null && delta !== 0 && (
              <span className={"text-sm " + (delta > 0 ? "text-up" : "text-down")}>
                {tr(delta > 0 ? "dashboard.sinceUp" : "dashboard.sinceDown", {
                  amount: money(last.base_currency).format(Math.abs(delta)),
                  date: fmtFull(first.date),
                })}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            {summary.as_of ? tr("dashboard.latestData", { date: fmtFull(summary.as_of) }) : ""}
            {tr("dashboard.counts", {
              institutions: summary.institutions,
              realAssets: summary.real_assets,
              debts: summary.liabilities,
            })}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <StatCard
            label={tr("dashboard.investments")}
            value={inSummary.format(summary.investments_total)}
            // Silence here would mean "all of this is a live figure", which is
            // only sometimes true: a position nothing can price is carried over
            // from its last photograph and should say so.
            note={
              summary.investments_at_book > 0
                ? tr("dashboard.carriedNote", {
                    amount: inSummary.format(summary.investments_at_book),
                  })
                : undefined
            }
          />
          <StatCard label={tr("dashboard.cash")} value={inSummary.format(summary.cash_total)} />
          <StatCard
            label={tr("dashboard.realAssets")}
            value={inSummary.format(summary.real_total)}
          />
          <StatCard
            label={tr("dashboard.debts")}
            value={inSummary.format(summary.liabilities_total)}
            valueClass={summary.liabilities_total > 0 ? "text-down" : "text-ink"}
          />
        </div>
      </section>

      {/* Right under the figure it qualifies: net worth is smaller than it was
          and no line says why. The Dashboard is where that difference has to be
          visible, not one page deeper — so the reader is told which page. */}
      <OmissionsNotice
        items={summary.unresolved_omissions ?? []}
        arrivals={summary.declared_instead ?? []}
        where={tr("omitted.inPortfolio")}
        baseCurrency={summary.base_currency}
      />

      {/* And the other direction: value that entered those same figures in a
          unit nobody could convert. Beside the omissions rather than tucked
          somewhere calmer, because both sentences qualify the number above
          them. */}
      <UnconvertedNotice
        items={summary.unconverted ?? []}
        baseCurrency={summary.base_currency}
      />

      {!hasData && (
        <EmptyState title={tr("dashboard.emptyTitle")}>
          {tr("dashboard.emptyBody")}
        </EmptyState>
      )}

      {series.length > 1 && (
        <ChartCard
          title={tr("dashboard.netWorthOverTime")}
          subtitle={tr("dashboard.netWorthOverTimeSub")}
          table={
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-rule text-[0.65rem] uppercase tracking-[0.12em] text-olive">
                  <th className="py-2 pr-4 font-semibold">{tr("dashboard.date")}</th>
                  <th className="py-2 pr-4 text-right font-semibold">{tr("dashboard.netWorth")}</th>
                  <th className="py-2 pr-4 text-right font-semibold">{tr("dashboard.financial")}</th>
                  <th className="py-2 pr-4 text-right font-semibold">{tr("dashboard.real")}</th>
                  <th className="py-2 text-right font-semibold">{tr("dashboard.debts")}</th>
                </tr>
              </thead>
              <tbody>
                {[...series].reverse().map((p) => (
                  <tr key={p.date} className="border-b border-hair last:border-0">
                    <td className="py-1.5 pr-4 text-ink-soft">{fmtFull(p.date)}</td>
                    <td className="py-1.5 pr-4 text-right font-medium">{money(p.base_currency).format(p.net_worth)}</td>
                    <td className="py-1.5 pr-4 text-right text-ink-soft">{money(p.base_currency).format(p.financial)}</td>
                    <td className="py-1.5 pr-4 text-right text-ink-soft">{money(p.base_currency).format(p.real)}</td>
                    <td className="py-1.5 text-right text-ink-soft">{money(p.base_currency).format(p.liabilities)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="var(--color-hair)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDay}
                minTickGap={28}
                tickMargin={8}
                tickLine={false}
                stroke="var(--color-rule)"
                tick={{ fontSize: 11, fill: "var(--color-ink-soft)" }}
              />
              <YAxis
                tickFormatter={(v) => compactFmt().format(Number(v))}
                width={52}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--color-ink-soft)" }}
              />
              <Tooltip
                content={(p) => <SeriesTooltip {...(p as unknown as TipProps)} />}
                cursor={{ stroke: "var(--color-rule)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="net_worth"
                stroke="var(--color-olive)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="var(--color-olive)"
                fillOpacity={0.1}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "var(--color-olive)",
                  stroke: "var(--color-surface)",
                  strokeWidth: 2,
                }}
              />
              {/* The endpoint is the value that matters: mark it. */}
              <ReferenceDot
                x={last.date}
                y={last.net_worth}
                r={5}
                fill="var(--color-olive)"
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {allocationItems.length > 0 && (
          <ChartCard
            title={tr("dashboard.allocation")}
            subtitle={tr("dashboard.allocationSub", {
              total: inAllocation.format(allocationTotal),
              count: allocationItems.length,
            })}
            table={
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-rule text-[0.65rem] uppercase tracking-[0.12em] text-olive">
                    <th className="py-2 pr-4 font-semibold">{tr("dashboard.class")}</th>
                    <th className="py-2 pr-4 text-right font-semibold">{tr("dashboard.value")}</th>
                    <th className="py-2 text-right font-semibold">{tr("dashboard.share")}</th>
                  </tr>
                </thead>
                <tbody>
                  {allocationItems.map((i) => (
                    <tr key={i.name} className="border-b border-hair last:border-0">
                      <td className="py-1.5 pr-4">{i.name}</td>
                      <td className="py-1.5 pr-4 text-right">{inAllocation.format(i.value)}</td>
                      <td className="py-1.5 text-right text-ink-soft">
                        {allocationTotal ? pctFmt().format(i.value / allocationTotal) : tr("common.na")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <RankedBars items={allocationItems} total={allocationTotal} unit={inAllocation} />
          </ChartCard>
        )}

        {cash && (
          <Panel title={tr("dashboard.monthlyCashFlow")}>
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-x-5">
                <StatCard
                  label={tr("dashboard.income")}
                  value={money(cash.base_currency).format(cash.monthly_income)}
                  valueClass="text-up"
                />
                <StatCard
                  label={tr("dashboard.expenses")}
                  value={money(cash.base_currency).format(cash.monthly_expenses)}
                  valueClass="text-down"
                />
                <StatCard
                  label={tr("dashboard.net")}
                  value={money(cash.base_currency).format(cash.monthly_net)}
                  valueClass={cash.monthly_net >= 0 ? "text-ink" : "text-down"}
                />
              </div>
              <Meter ratio={cash.savings_rate} />
              <p className="text-xs text-ink-soft">
                {tr("dashboard.cashBreakdown", {
                  active: money(cash.base_currency).format(cash.active_income),
                  passive: money(cash.base_currency).format(cash.passive_income),
                  essential: money(cash.base_currency).format(cash.essential_expenses),
                  discretionary: money(cash.base_currency).format(cash.discretionary_expenses),
                })}
                {inForceIntro()}{" "}
                {notCounted(cash) && tr("inForce.notCounted", { what: notCounted(cash) })}
                {undatedLine(cash.undated) && ` ${undatedLine(cash.undated)}`}
              </p>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
