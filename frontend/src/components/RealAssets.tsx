import { useEffect, useState, type FormEvent } from "react";
import { joinList, tOpt, useT } from "../i18n/index.ts";
import {
  createRealAsset,
  createValuation,
  deleteRealAsset,
  deleteValuation,
  getRealAsset,
  getRealAssets,
  getValuations,
  updateRealAsset,
  updateValuation,
  type RealAsset,
  type RealAssetValuation,
} from "../api/realAssets";
import { getLiabilities, type Liability } from "../api/liabilities";
import {
  Breadcrumb,
  Row,
  RowsOrEmpty,
  Section,
  apiError,
  btnClass,
  inputClass,
  money,
  type Crumb,
  CURRENCY_LIST,
} from "./ui";
import { CancelButton } from "./ui";
import { getBaseCurrency } from "../api/baseCurrency";
import { DatedAmountEditor } from "./DatedAmountEditor";
import { useReopened } from "./reopen";
import { REAL_ASSET, VALUATION, marks, refusal } from "./required";

const CATEGORIES = ["", "real_estate", "vehicle", "collectible", "jewelry", "art", "other"];

/* Which asset is open is App's state, so the chat can be told which one "this"
   is, and so the page is where you left it when you come back to Records. On
   arrival the asset is read again; one that is gone climbs to the list. See
   reopen.ts. */
export default function RealAssets({
  asset,
  onAsset,
}: {
  asset: RealAsset | null;
  onAsset: (a: RealAsset | null) => void;
}) {
  const checked = useReopened(asset, getRealAsset, onAsset);
  const tr = useT();
  if (!checked) return null;

  const crumbs: Crumb[] = [
    { label: tr("nav.pages.real"), active: !asset, onClick: () => onAsset(null) },
  ];
  if (asset) crumbs.push({ label: asset.name, active: true, onClick: () => {} });

  return (
    <div className="space-y-5">
      <Breadcrumb items={crumbs} />
      {!asset ? (
        <AssetsLevel onSelect={onAsset} />
      ) : (
        <ValuationsLevel asset={asset} />
      )}
    </div>
  );
}

/** A stored category code in the reader's words; a code nothing has been named
    for is shown as stored rather than dropped. */
function categoryLabel(c: string | null): string | null {
  return c ? (tOpt(`code.${c}`) ?? c) : null;
}

function AssetsLevel({ onSelect }: { onSelect: (a: RealAsset) => void }) {
  const tr = useT();
  const [items, setItems] = useState<RealAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The form's refusals and failed saves, apart from a failed load: RowsOrEmpty
  // shows an error INSTEAD of the rows, so a sentence about the form must not
  // go there (SnapshotsLevel learned this first).
  const [formError, setFormError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  /* An asset belongs to no account: its currency is proposed from the base the
     reader chose, and what they type in the box wins. */
  const [base, setBase] = useState("");
  const [currencyChoice, setCurrencyChoice] = useState<string | null>(null);
  const currency = currencyChoice ?? base;
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [assets, b] = await Promise.all([getRealAssets(), getBaseCurrency()]);
      setItems(assets);
      setBase(b.base_currency);
    } catch (err) {
      setError(apiError(err, tr("real.backendUnreachable")));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setEditId(null);
    setName("");
    setCategory("");
    setCurrencyChoice(null);
  }

  function startEdit(a: RealAsset) {
    setEditId(a.id);
    setName(a.name);
    setCategory(a.category ?? "");
    setCurrencyChoice(a.currency);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    // The currency is typed here, so it can be left empty. Said rather than
    // sent: the backend would refuse it too, but REAL_ASSET's sentence names
    // the box.
    const refused = refusal(REAL_ASSET, { name, currency });
    if (refused) {
      setFormError(refused);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const payload = {
      name: name.trim(),
      category: category || null,
      currency: currency.trim(),
    };
    try {
      if (editId != null) await updateRealAsset(editId, payload);
      else await createRealAsset(payload);
      reset();
      await load();
    } catch (err) {
      setFormError(apiError(err, tr("common.saveFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(a: RealAsset) {
    if (!window.confirm(tr("real.deleteConfirm", { name: a.name }))) return;
    setError(null);
    try {
      await deleteRealAsset(a.id);
      if (editId === a.id) reset();
      await load();
    } catch (err) {
      setError(apiError(err, tr("real.deleteFailed")));
    }
  }

  return (
    <Section title={tr("nav.pages.real")}>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input className={inputClass} aria-label={tr("real.name")} {...marks(REAL_ASSET, "name")} value={name} onChange={(e) => setName(e.target.value)} />
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (<option key={c} value={c}>{c ? (tOpt(`code.${c}`) ?? c) : tr("real.categoryBlank")}</option>))}
        </select>
        <input className={inputClass + " w-24"} placeholder={tr("real.currency")} {...marks(REAL_ASSET, "currency")} list={CURRENCY_LIST} title={tr("real.currencyTitle")} value={currency} onChange={(e) => setCurrencyChoice(e.target.value)} />
        <button className={btnClass} disabled={submitting}>{submitting ? "..." : editId != null ? tr("common.save") : tr("common.add")}</button>
        {editId != null && <CancelButton onClick={reset} />}
      </form>
      {formError && <p className="text-down">{formError}</p>}
      <RowsOrEmpty loading={loading} error={error} empty={items.length === 0} emptyText={tr("real.noRealAssets")}>
        {items.map((a) => (
          <Row key={a.id} onClick={() => onSelect(a)} onEdit={() => startEdit(a)} note={a.notes} onDelete={() => remove(a)} title={a.name} badge={categoryLabel(a.category)} subtitle={a.currency} />
        ))}
      </RowsOrEmpty>
    </Section>
  );
}

function ValuationsLevel({ asset }: { asset: RealAsset }) {
  const tr = useT();
  const [items, setItems] = useState<RealAssetValuation[]>([]);
  const [linkedDebts, setLinkedDebts] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [asset.id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [vals, liabs] = await Promise.all([
        getValuations(asset.id),
        getLiabilities(),
      ]);
      setItems(vals);
      setLinkedDebts(liabs.filter((l) => l.real_asset_id === asset.id));
    } catch (err) {
      setError(apiError(err, tr("real.loadValuations")));
    } finally {
      setLoading(false);
    }
  }

  // Equity = latest valuation − outstanding debt financing this asset, and
  // only when both are in the same currency. These are the figures as typed,
  // each in its own currency; subtracting a dollar balance from a euro
  // valuation here would be a conversion written in the browser, beside the
  // one the backend runs for every total. The net worth converts both.
  const latestValue = items.length ? items[items.length - 1].value : null;
  const sameCurrency = (l: Liability) =>
    l.currency.toUpperCase() === asset.currency.toUpperCase();
  const otherCurrency = linkedDebts.filter((l) => !sameCurrency(l));
  const debtTotal = linkedDebts
    .filter(sameCurrency)
    .reduce((acc, l) => acc + (l.latest_balance ?? 0), 0);
  const equity =
    latestValue != null && otherCurrency.length === 0 ? latestValue - debtTotal : null;
  // All three figures are in the asset's currency, which the guard above is
  // what guarantees.
  const inAsset = money(asset.currency);

  return (
    <Section title={tr("real.valuationsOf", { name: asset.name })}>
      {equity != null && linkedDebts.length > 0 && (
        <p className="rounded-sm bg-ground p-3 text-sm text-ink-soft">
          {tr
            .rich("real.equityLine", {
              value: inAsset.format(latestValue!),
              debt: inAsset.format(debtTotal),
              names: joinList(linkedDebts.map((l) => l.name)),
              equity: inAsset.format(equity),
            })
            .map((p, i) =>
              p.kind === "strong" ? (
                <strong key={i} className="text-ink">{p.value}</strong>
              ) : p.kind === "em" ? (
                <em key={i}>{p.value}</em>
              ) : (
                <span key={i}>{p.value}</span>
              ),
            )}
        </p>
      )}
      {otherCurrency.length > 0 && (
        <p className="rounded-sm bg-ground p-3 text-sm text-ink-soft">
          {tr("real.equitySkipped", {
            list: joinList(
              otherCurrency.map((l) => tr("real.debtInCurrency", { name: l.name, currency: l.currency })),
            ),
            currency: asset.currency,
          })}
        </p>
      )}
      <DatedAmountEditor
        items={items}
        loading={loading}
        loadError={error}
        dateOf={(v) => v.date}
        amountOf={(v) => v.value}
        currencyOf={() => asset.currency}
        toPayload={(date, value) => ({ date, value })}
        create={(p) => createValuation(asset.id, p)}
        update={updateValuation}
        destroy={deleteValuation}
        onChanged={load}
        noun={tr("dated.noun.valuation")}
        amountLabel={tr("real.value")}
        needs={VALUATION}
        emptyText={tr("real.noValuations")}
      />
    </Section>
  );
}
