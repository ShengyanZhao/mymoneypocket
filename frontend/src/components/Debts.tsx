import { useEffect, useState, type FormEvent } from "react";
import { tOpt, useT } from "../i18n/index.ts";
import {
  createBalance,
  createLiability,
  deleteBalance,
  deleteLiability,
  getBalances,
  getLiabilities,
  getLiability,
  updateBalance,
  updateLiability,
  type Liability,
  type LiabilityBalance,
} from "../api/liabilities";
import { getRealAssets, type RealAsset } from "../api/realAssets";
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
import LoanPlan from "./LoanPlan";
import { useReopened } from "./reopen";
import { BALANCE, DEBT, marks, refusal } from "./required";

const KINDS = [
  "",
  "mortgage",
  "mortgage_cn",
  "personal_loan",
  "auto_loan",
  "student_loan",
  "credit_card",
  "credit_card_installment",
  "huabei",
  "baitiao",
  "consumer_loan",
  "other",
];

/** A stored kind code in the reader's words ("personal_loan" -> "personal
    loan" in English, 个人贷款 in Chinese); an unknown one is shown as stored
    rather than dropped. */
function kindLabel(s: string | null): string | null {
  return s ? (tOpt(`debts.kind.${s}`) ?? s.replace(/_/g, " ")) : null;
}

/* Which debt is open is App's state, so the chat can be told which one "this"
   is, and so the page is where you left it when you come back to Records. On
   arrival the debt is read again; one that is gone climbs to the list. See
   reopen.ts. */
export default function Debts({
  liability,
  onLiability,
}: {
  liability: Liability | null;
  onLiability: (l: Liability | null) => void;
}) {
  const checked = useReopened(liability, getLiability, onLiability);
  const tr = useT();
  if (!checked) return null;

  const crumbs: Crumb[] = [
    { label: tr("nav.pages.debts"), active: !liability, onClick: () => onLiability(null) },
  ];
  if (liability) crumbs.push({ label: liability.name, active: true, onClick: () => {} });

  return (
    <div className="space-y-5">
      <Breadcrumb items={crumbs} />
      {!liability ? (
        <DebtsLevel onSelect={onLiability} />
      ) : (
        <>
          {/* The plan beside the bank's own balances (PRD v3 §4.4): what the
              schedule says, what the reader recorded, and the question about
              paying early — then the dated balances themselves. */}
          <LoanPlan
            liability={liability}
            onChanged={() => {
              void getLiability(liability.id).then(onLiability);
            }}
          />
          <BalancesLevel liability={liability} />
        </>
      )}
    </div>
  );
}

function DebtsLevel({ onSelect }: { onSelect: (l: Liability) => void }) {
  const tr = useT();
  const [items, setItems] = useState<Liability[]>([]);
  const [assets, setAssets] = useState<RealAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The form's refusals and failed saves, apart from a failed load: RowsOrEmpty
  // shows an error INSTEAD of the rows, so a sentence about the form must not
  // go there (SnapshotsLevel learned this first).
  const [formError, setFormError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("");
  const [rate, setRate] = useState("");
  const [assetId, setAssetId] = useState("");
  /* A debt belongs to no account, so there is none to propose its currency
     from: the base the reader chose is the proposal, and what they type in the
     box wins. An edited debt keeps its own. */
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
      const [liabs, ras, b] = await Promise.all([getLiabilities(), getRealAssets(), getBaseCurrency()]);
      setItems(liabs);
      setAssets(ras);
      setBase(b.base_currency);
    } catch (err) {
      setError(apiError(err, tr("debts.backendUnreachable")));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setEditId(null);
    setName("");
    setKind("");
    setRate("");
    setAssetId("");
    setCurrencyChoice(null);
  }

  function startEdit(l: Liability) {
    setEditId(l.id);
    setName(l.name);
    setKind(l.kind ?? "");
    setRate(l.interest_rate != null ? String(l.interest_rate) : "");
    setAssetId(l.real_asset_id ? String(l.real_asset_id) : "");
    setCurrencyChoice(l.currency);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const refused = refusal(DEBT, { name, currency });
    if (refused) {
      setFormError(refused);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const payload = {
      name: name.trim(),
      kind: kind || null,
      currency: currency.trim(),
      interest_rate: rate ? Number(rate) : null,
      real_asset_id: assetId ? Number(assetId) : null,
    };
    try {
      if (editId != null) await updateLiability(editId, payload);
      else await createLiability(payload);
      reset();
      await load();
    } catch (err) {
      setFormError(apiError(err, tr("common.saveFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(l: Liability) {
    if (!window.confirm(tr("debts.deleteConfirm", { name: l.name }))) return;
    setError(null);
    try {
      await deleteLiability(l.id);
      if (editId === l.id) reset();
      await load();
    } catch (err) {
      setError(apiError(err, tr("debts.deleteFailed")));
    }
  }

  function assetName(id: number | null): string | undefined {
    if (id == null) return undefined;
    return assets.find((a) => a.id === id)?.name;
  }

  function debtSubtitle(l: Liability): string | undefined {
    const parts: string[] = [];
    const linked = assetName(l.real_asset_id);
    if (linked) parts.push(tr("debts.finances", { name: linked }));
    if (l.interest_rate != null) parts.push(tr("debts.ratePerYear", { rate: l.interest_rate }));
    return parts.length ? parts.join(" · ") : undefined;
  }

  return (
    <Section
      title={tr("nav.pages.debts")}
      hint={tr("debts.hint")}
    >
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input className={inputClass} aria-label={tr("debts.name")} {...marks(DEBT, "name")} value={name} onChange={(e) => setName(e.target.value)} />
        <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (<option key={k} value={k}>{k ? (kindLabel(k) ?? k) : tr("debts.kindBlank")}</option>))}
        </select>
        <input className={inputClass + " w-28"} type="number" step="0.01" placeholder={tr("debts.ratePlaceholder")} value={rate} onChange={(e) => setRate(e.target.value)} />
        <input
          className={inputClass + " w-20"}
          placeholder={tr("debts.currency")}
          {...marks(DEBT, "currency")}
          list={CURRENCY_LIST}
          title={tr("debts.currencyTitle")}
          value={currency}
          onChange={(e) => setCurrencyChoice(e.target.value)}
        />
        <select className={inputClass} value={assetId} onChange={(e) => setAssetId(e.target.value)}>
          <option value="">{tr("debts.financesAsset")}</option>
          {assets.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
        </select>
        <button className={btnClass} disabled={submitting}>{submitting ? "..." : editId != null ? tr("common.save") : tr("common.add")}</button>
        {editId != null && <CancelButton onClick={reset} />}
      </form>
      {formError && <p className="text-bad">{formError}</p>}
      <RowsOrEmpty loading={loading} error={error} empty={items.length === 0} emptyText={tr("debts.noDebts")}>
        {items.map((l) => (
          <Row
            key={l.id}
            onClick={() => onSelect(l)}
            onEdit={() => startEdit(l)}
            onDelete={() => remove(l)}
            title={l.name}
            badge={kindLabel(l.kind)}
            subtitle={debtSubtitle(l)}
            note={l.notes}
            value={l.latest_balance != null ? money(l.currency).format(l.latest_balance) : undefined}
          />
        ))}
      </RowsOrEmpty>
    </Section>
  );
}

function BalancesLevel({ liability }: { liability: Liability }) {
  const tr = useT();
  const [items, setItems] = useState<LiabilityBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [liability.id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await getBalances(liability.id));
    } catch (err) {
      setError(apiError(err, tr("debts.loadBalances")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section
      title={tr("debts.outstandingOf", { name: liability.name })}
      explain={{
        question: tr("debts.outstandingQuestion"),
        text: tr("debts.outstandingText"),
      }}
    >
      <DatedAmountEditor
        items={items}
        loading={loading}
        loadError={error}
        dateOf={(b) => b.date}
        amountOf={(b) => b.balance}
        currencyOf={() => liability.currency}
        toPayload={(date, balance) => ({ date, balance })}
        create={(p) => createBalance(liability.id, p)}
        update={updateBalance}
        destroy={deleteBalance}
        onChanged={load}
        noun={tr("dated.noun.balance")}
        amountLabel={tr("debts.remaining")}
        needs={BALANCE}
        emptyText={tr("debts.noBalances")}
      />
    </Section>
  );
}
