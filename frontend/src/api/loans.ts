import { api } from "./client";
import type { Schemas } from "./types";

// The loan's plan and the choice about paying early (PRD v3 §4.4, 负债 2.0).
// A plan is a projection beside the balances the reader recorded; a Decision
// is a comparison kept — it moves no money and writes no balance.

export type LoanPlanRead = Schemas["LoanPlanRead"];
export type PaymentRow = Schemas["PaymentRow"];
export type InterestYear = Schemas["InterestYear"];
export type PrepayRequest = Schemas["PrepayRequest"];
export type PrepayComparison = Schemas["PrepayComparison"];
export type PrepayOption = Schemas["PrepayOption"];
export type DecisionRead = Schemas["DecisionRead"];
export type DecisionCreate = Schemas["DecisionCreate"];

// GET /api/liabilities/{id}/plan — the schedule its terms describe, beside
// the recorded balance, with the difference named.
export async function getLoanPlan(liabilityId: number): Promise<LoanPlanRead> {
  return (await api.get<LoanPlanRead>(`/api/liabilities/${liabilityId}/plan`)).data;
}

// POST /api/liabilities/{id}/prepay — what paying early saves against what
// the money would earn invested. No mode named: BOTH answers, as the
// decision card shows them.
export async function prepayCompare(
  liabilityId: number,
  data: PrepayRequest,
): Promise<PrepayComparison> {
  return (await api.post<PrepayComparison>(`/api/liabilities/${liabilityId}/prepay`, data)).data;
}

// GET /api/decisions — every comparison the reader saved, newest first.
export async function getDecisions(): Promise<DecisionRead[]> {
  return (await api.get<DecisionRead[]>("/api/decisions")).data;
}

// POST /api/decisions — keep a choice. Writes no balance; executing it is a
// dated balance row the reader writes when it happens.
export async function createDecision(data: DecisionCreate): Promise<DecisionRead> {
  return (await api.post<DecisionRead>("/api/decisions", data)).data;
}
