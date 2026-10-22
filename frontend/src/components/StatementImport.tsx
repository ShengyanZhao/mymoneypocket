import { useEffect, useState } from "react";
import {
  commitImport,
  deleteCashEntry,
  deleteImport,
  getCashEntries,
  getTaxonomy,
  listImports,
  previewImport,
  type CashEntryRead,
  type ImportBatchRead,
  type ImportCandidate,
  type ImportPreview,
  type TaxonomyRead,
} from "../api/imports";
import type { Institution } from "../api/institutions";
import { RowsOrEmpty, Row, Section, apiError, inputClass } from "./ui";
import { HiddenNote, matchesMember, type MemberFilter } from "./MemberPicker";
import { tOpt, useT } from "../i18n/index.ts";

/* The statement lane's whole surface: pick a file, see what is in it, confirm
   it, and undo what one file added.

   The preview is the point. An importer that writes as it reads cannot show
   the reader what it decided — the closed orders it refused, the transfers it
   paired, the rows it has seen before — and every one of those is a judgement
   the reader may overrule BEFORE anything is stored. So the component holds
   the parsed rows in its own state, lets the category box be corrected per
   row, and only then posts them as one batch. */

/** A code in the reader's words, like `CashFlow`'s codeWord: a category the
    taxonomy (or its aliases) has no label for reads as itself. */
function categoryWord(code: string | null | undefined): string | null {
  return code ? (tOpt(`cash.category.${code}`) ?? code) : null;
}

function sourceWord(tr: ReturnType<typeof useT>, source: string): string {
  return tr(`imports.source.${source}` as Parameters<typeof tr>[0]);
}

export default function StatementImport({
  institutions,
  filter,
  memberName,
  onChanged,
}: {
  institutions: Institution[];
  /** The page's member filter (PRD v3 §4.1): changes what is shown here,
      never what is stored. */
  filter: MemberFilter;
  memberName: (id: number | null) => string | null;
  /** Called after a commit or an undo: the page's own totals read differently
      once a statement is in, and this is how it hears about it. */
  onChanged: () => void;
}) {
  const tr = useT();
  const [taxonomy, setTaxonomy] = useState<TaxonomyRead | null>(null);
  const [batches, setBatches] = useState<ImportBatchRead[]>([]);
  const [entries, setEntries] = useState<CashEntryRead[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [institutionId, setInstitutionId] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  // Per-row category corrections, by candidate index: what the rules guessed
  // is a suggestion the reader can overrule before the commit.
  const [categories, setCategories] = useState<Record<number, string>>({});
  // Which suspected transfer pairs to confirm, by pair index. Ticked by
  // default: the pairing is only marks on rows, and the reader unticks what
  // the guess got wrong.
  const [pairs, setPairs] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const [tax, bs, es] = await Promise.all([
        getTaxonomy(),
        listImports(),
        getCashEntries(),
      ]);
      setTaxonomy(tax);
      setBatches(bs);
      setEntries(es);
    } catch (e) {
      setError(apiError(e, tr("imports.failed")));
    }
  }

  async function doPreview() {
    if (!file || !institutionId) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const p = await previewImport(file, Number(institutionId));
      setPreview(p);
      setCategories(
        Object.fromEntries(p.candidates.map((c, i) => [i, c.category ?? ""])),
      );
      setPairs(Object.fromEntries(p.transfer_pairs.map((_, i) => [i, true])));
    } catch (e) {
      setPreview(null);
      setError(apiError(e, tr("imports.failed")));
    } finally {
      setBusy(false);
    }
  }

  async function doCommit() {
    if (!preview || !institutionId) return;
    setBusy(true);
    setError(null);
    try {
      const candidates: ImportCandidate[] = preview.candidates.map((c, i) => ({
        ...c,
        category: categories[i] || c.category || null,
      }));
      const pair_indices = preview.transfer_pairs
        .map((p, i) => (pairs[i] ? ([p.out_index, p.in_index] as [number, number]) : null))
        .filter((p): p is [number, number] => p !== null);
      const out = await commitImport({
        institution_id: Number(institutionId),
        source: preview.source,
        filename: preview.filename,
        candidates,
        pair_indices,
      });
      setMessage(
        out.duplicates_skipped > 0
          ? tr("imports.doneSkipped", {
              count: out.written,
              duplicates: out.duplicates_skipped,
            })
          : tr("imports.done", { count: out.written }),
      );
      setPreview(null);
      setFile(null);
      await refresh();
      onChanged();
    } catch (e) {
      setError(apiError(e, tr("imports.failed")));
    } finally {
      setBusy(false);
    }
  }

  async function undo(batch: ImportBatchRead) {
    if (!window.confirm(tr("imports.deleteBatchAsk", { count: batch.rows_written }))) return;
    try {
      await deleteImport(batch.id);
      await refresh();
      onChanged();
    } catch (e) {
      setError(apiError(e, tr("imports.failed")));
    }
  }

  async function removeEntry(id: number) {
    try {
      await deleteCashEntry(id);
      await refresh();
      onChanged();
    } catch (e) {
      setError(apiError(e, tr("imports.failed")));
    }
  }

  const dupIndices = new Set(preview?.duplicates ?? []);
  const legIndices = new Set(
    (preview?.transfer_pairs ?? [])
      .map((p, i) => (pairs[i] ? [p.out_index, p.in_index] : null))
      .filter((x): x is number[] => x !== null)
      .flat(),
  );

  return (
    <div>
      <Section title={tr("imports.title")} hint={tr("imports.hint")}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{tr("imports.account")}</span>
            <select
              className={inputClass}
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
            >
              <option value="" disabled>
                {tr("imports.account")}
              </option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">{tr("imports.choose")}</span>
            <input
              type="file"
              accept=".csv,.txt"
              className="text-sm"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setMessage(null);
              }}
            />
          </label>
          <button
            className="rounded-sm bg-ink px-4 py-2 text-sm text-surface disabled:opacity-40"
            disabled={!file || !institutionId || busy}
            onClick={() => void doPreview()}
          >
            {tr("imports.previewBtn")}
          </button>
        </div>
        {message && <p className="mt-2 text-sm text-brand-deep">{message}</p>}
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </Section>

      {preview && (
        <Section
          title={tr("imports.rowsSeen", { count: preview.rows_seen })}
          hint={[
            preview.duplicates.length > 0
              ? tr("imports.duplicates", { count: preview.duplicates.length })
              : null,
            preview.transfer_pairs.length > 0
              ? tr("imports.pairs", { count: preview.transfer_pairs.length })
              : null,
            preview.unreadable.length > 0
              ? tr("imports.unreadable", { count: preview.unreadable.length })
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-soft">
                <th className="py-1">{tr("imports.colDate")}</th>
                <th>{tr("imports.colDirection")}</th>
                <th>{tr("imports.colCounterparty")}</th>
                <th>{tr("imports.colCategory")}</th>
                <th className="text-right">{tr("imports.colAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {preview.candidates.map((c, i) => (
                <tr
                  key={i}
                  className={
                    "border-t border-rule " +
                    (dupIndices.has(i) ? "opacity-40" : "")
                  }
                >
                  <td className="py-1">{c.date}</td>
                  <td>
                    {c.direction === "in" ? "+" : "−"}
                    {legIndices.has(i) && (
                      <span className="ml-1 text-xs text-brand">{tr("imports.legMark")}</span>
                    )}
                  </td>
                  <td className="truncate">{c.counterparty ?? "—"}</td>
                  <td>
                    <select
                      className={inputClass + " py-0.5"}
                      value={categories[i] ?? ""}
                      onChange={(e) =>
                        setCategories((m) => ({ ...m, [i]: e.target.value }))
                      }
                    >
                      <option value="">{tr("cash.categoryBlank")}</option>
                      {(taxonomy?.entry ?? []).map((code) => (
                        <option key={code} value={code}>
                          {categoryWord(code)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="text-right tabular-nums">
                    {c.direction === "in" ? "+" : "−"}
                    {c.amount.toFixed(2)} {c.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {preview.transfer_pairs.length > 0 && (
            <div className="mt-3 space-y-1 text-sm">
              {preview.transfer_pairs.map((p, i) => (
                <label key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pairs[i] ?? true}
                    onChange={(e) => setPairs((m) => ({ ...m, [i]: e.target.checked }))}
                  />
                  <span>
                    {preview.candidates[p.out_index]?.counterparty} →{" "}
                    {preview.candidates[p.in_index]?.counterparty} (
                    {preview.candidates[p.out_index]?.amount.toFixed(2)})
                  </span>
                </label>
              ))}
            </div>
          )}

          {preview.unreadable.length > 0 && (
            <details className="mt-3 text-sm text-ink-soft">
              <summary>{tr("imports.unreadable", { count: preview.unreadable.length })}</summary>
              <ul className="mt-1 list-inside list-disc">
                {preview.unreadable.map((line, i) => (
                  <li key={i} className="truncate font-mono text-xs">
                    {line}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-4 flex gap-2">
            <button
              className="rounded-sm bg-ink px-4 py-2 text-sm text-surface disabled:opacity-40"
              disabled={busy}
              onClick={() => void doCommit()}
            >
              {tr("imports.confirm", {
                count: preview.candidates.length - preview.duplicates.length,
              })}
            </button>
            <button
              className="rounded-sm px-4 py-2 text-sm text-ink-soft"
              onClick={() => setPreview(null)}
            >
              {tr("imports.cancel")}
            </button>
          </div>
        </Section>
      )}

      <Section title={tr("imports.batches")}>
        <RowsOrEmpty
          loading={false}
          error={null}
          empty={batches.length === 0}
          emptyText={tr("imports.noBatches")}
        >
          {batches.map((b) => (
            <Row
              key={b.id}
              title={tr("imports.batchLine", {
                source: sourceWord(tr, b.source),
                filename: b.filename ?? "—",
                written: b.rows_written,
                from: b.date_from ?? "—",
                to: b.date_to ?? "—",
              })}
              onDelete={() => void undo(b)}
            />
          ))}
        </RowsOrEmpty>
      </Section>

      <Section title={tr("imports.entriesTitle")}>
        {/* The page's member filter reaches here too: a row's attribution is
            its own fact, and hiding rows is always said out loud below. */}
        <RowsOrEmpty
          loading={false}
          error={null}
          empty={entries.filter((e) => matchesMember(e.member_id, filter)).length === 0}
          emptyText={tr("imports.noEntries")}
        >
          {entries
            .filter((e) => matchesMember(e.member_id, filter))
            .map((e) => (
              <Row
                key={e.id}
                title={`${e.date} · ${e.direction === "in" ? "+" : "−"}${e.amount.toFixed(2)} ${e.currency}`}
                subtitle={[e.counterparty, categoryWord(e.category), memberName(e.member_id)]
                  .filter(Boolean)
                  .join(" · ")}
                onDelete={() => void removeEntry(e.id)}
              />
            ))}
        </RowsOrEmpty>
        <HiddenNote
          hidden={entries.filter((e) => !matchesMember(e.member_id, filter)).length}
          filter={filter}
        />
      </Section>
    </div>
  );
}
