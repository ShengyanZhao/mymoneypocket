import { api } from "./client";
import type { Schemas } from "./types";

// Budgets and the monthly review (PRD v3 §4.2, 预算与复盘). A budget says
// what a month may reach; a review says what a month did. Neither blocks a
// row — spending is a fact — and the review is computed from the ledger each
// time it is read, so its numbers cannot drift from the rows it names.

export type BudgetRead = Schemas["BudgetRead"];
export type BudgetCreate = Schemas["BudgetCreate"];
export type BudgetUpdate = Schemas["BudgetUpdate"];
export type BudgetOverview = Schemas["BudgetOverview"];
export type BudgetSlice = Schemas["BudgetSlice"];
export type MonthActuals = Schemas["MonthActuals"];
export type MonthReviewRead = Schemas["MonthReviewRead"];
export type ReviewMover = Schemas["ReviewMover"];
export type ReviewSuggestion = Schemas["ReviewSuggestion"];
export type ReviewResolution = Schemas["ReviewResolution"];

// GET /api/budgets — every budget line, oldest first.
export async function getBudgets(): Promise<BudgetRead[]> {
  return (await api.get<BudgetRead[]>("/api/budgets")).data;
}

// POST /api/budgets — one line per (month, category); 409 if the month and
// category already have one (a change from a month onward is a new line).
export async function createBudget(data: BudgetCreate): Promise<BudgetRead> {
  return (await api.post<BudgetRead>("/api/budgets", data)).data;
}

// PATCH /api/budgets/{id} — the line's size and habits, not its identity.
export async function updateBudget(id: number, data: BudgetUpdate): Promise<BudgetRead> {
  return (await api.patch<BudgetRead>(`/api/budgets/${id}`, data)).data;
}

// DELETE /api/budgets/{id}
export async function deleteBudget(id: number): Promise<void> {
  await api.delete(`/api/budgets/${id}`);
}

// GET /api/budgets/overview?month=YYYY-MM — every line against what has been
// spent of it: progress, what is left, and the daily allowance.
export async function getBudgetOverview(month?: string): Promise<BudgetOverview> {
  return (await api.get<BudgetOverview>("/api/budgets/overview", { params: month ? { month } : {} }))
    .data;
}

// GET /api/months/actuals?month=YYYY-MM — what actually moved, per category.
export async function getMonthActuals(month?: string): Promise<MonthActuals> {
  return (await api.get<MonthActuals>("/api/months/actuals", { params: month ? { month } : {} }))
    .data;
}

// GET /api/reviews?month=YYYY-MM — the month, computed from its rows.
export async function getMonthReview(month?: string): Promise<MonthReviewRead> {
  return (await api.get<MonthReviewRead>("/api/reviews", { params: month ? { month } : {} })).data;
}

// POST /api/reviews/resolutions — accepted or ignored. Accepted WITH an
// amount writes that amount into the category's budget from next month.
export async function resolveSuggestion(data: ReviewResolution): Promise<Record<string, string>> {
  return (await api.post<Record<string, string>>("/api/reviews/resolutions", data)).data;
}
