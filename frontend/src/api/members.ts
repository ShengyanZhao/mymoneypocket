import { api } from "./client";
import type { Schemas } from "./types";

// The household: who this ledger is about (PRD v3 §4.1, 家庭账本). Members are
// an attribution dimension, not logins — one database, one reader — and every
// row of money may name one. Null is 共同 (shared), a first-class answer.

export type Member = Schemas["MemberRead"];
export type MemberCreate = Schemas["MemberCreate"];
export type MemberUpdate = Schemas["MemberUpdate"];
export type MemberAssign = Schemas["MemberAssign"];
export type MemberAssignResult = Schemas["MemberAssignResult"];
export type MemberWorthSlice = Schemas["MemberWorthSlice"];
export type MemberFlowSlice = Schemas["MemberFlowSlice"];

// GET /api/members — the household, oldest first.
export async function getMembers(): Promise<Member[]> {
  return (await api.get<Member[]>("/api/members")).data;
}

// POST /api/members — add someone to the household.
export async function createMember(data: MemberCreate): Promise<Member> {
  return (await api.post<Member>("/api/members", data)).data;
}

// PATCH /api/members/{id} — rename, or change how they are described. Their
// rows are untouched: an edit of the person is not an edit of their history.
export async function updateMember(id: number, data: MemberUpdate): Promise<Member> {
  return (await api.patch<Member>(`/api/members/${id}`, data)).data;
}

// DELETE /api/members/{id} — their rows go on as shared (共同).
export async function deleteMember(id: number): Promise<void> {
  await api.delete(`/api/members/${id}`);
}

// POST /api/institutions/{id}/assign — say whose account this is and stamp the
// unnamed history on it. Rows that already name somebody keep their name.
export async function assignInstitution(
  institutionId: number,
  data: MemberAssign,
): Promise<MemberAssignResult> {
  return (await api.post<MemberAssignResult>(`/api/institutions/${institutionId}/assign`, data))
    .data;
}
