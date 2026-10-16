import { api } from "./client";
import type { Schemas } from "./types";

// The statement lane: read an exported Alipay/WeChat bill, confirm it, and
// undo what a file added. One import is one batch — the unit of both the
// commit's idempotency and the delete's undoing.

export type ImportPreview = Schemas["ImportPreview"];
export type ImportCandidate = Schemas["ImportCandidate"];
export type ImportCommit = Schemas["ImportCommit"];
export type ImportBatchRead = Schemas["ImportBatchRead"];
export type ImportCommitResult = Schemas["ImportCommitResult"];
export type CashEntryRead = Schemas["CashEntryRead"];
export type CashEntryCreate = Schemas["CashEntryCreate"];
export type TaxonomyRead = Schemas["TaxonomyRead"];

// POST /api/imports/preview — parses the file and writes NOTHING. Names the
// account so the duplicate check can ask ITS store (two overlapping files only
// meet there); without one, every row is simply "not known here yet".
export async function previewImport(
  file: File,
  institutionId?: number,
): Promise<ImportPreview> {
  const form = new FormData();
  form.append("file", file);
  return (
    await api.post<ImportPreview>("/api/imports/preview", form, {
      params: institutionId != null ? { institution_id: institutionId } : {},
    })
  ).data;
}

// POST /api/imports/commit — the confirmed rows as one batch, idempotent per
// row (the statement's own transaction numbers).
export async function commitImport(data: ImportCommit): Promise<ImportCommitResult> {
  return (await api.post<ImportCommitResult>("/api/imports/commit", data)).data;
}

// GET /api/imports — every import, newest first: the list to undo from.
export async function listImports(): Promise<ImportBatchRead[]> {
  return (await api.get<ImportBatchRead[]>("/api/imports")).data;
}

// DELETE /api/imports/{id} — undo one import; hand-typed rows stay.
export async function deleteImport(id: number): Promise<void> {
  await api.delete(`/api/imports/${id}`);
}

// GET /api/cash-entries — stored movements, newest first.
export async function getCashEntries(params?: {
  institution_id?: number;
  batch_id?: number;
  date_from?: string;
  date_to?: string;
}): Promise<CashEntryRead[]> {
  return (await api.get<CashEntryRead[]>("/api/cash-entries", { params })).data;
}

// POST /api/cash-entries — one movement typed by hand.
export async function createCashEntry(data: CashEntryCreate): Promise<CashEntryRead> {
  return (await api.post<CashEntryRead>("/api/cash-entries", data)).data;
}

// DELETE /api/cash-entries/{id}
export async function deleteCashEntry(id: number): Promise<void> {
  await api.delete(`/api/cash-entries/${id}`);
}

// GET /api/taxonomy — the category words every form offers, and the aliases
// that read rows stored under an old code.
export async function getTaxonomy(): Promise<TaxonomyRead> {
  return (await api.get<TaxonomyRead>("/api/taxonomy")).data;
}
