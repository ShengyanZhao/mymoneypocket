import { api } from "./client";
import type { Schemas } from "./types";

// Bills, the calendar and the forecast (PRD v3 §4.3, 账单日历与现金流预测).
// A bill is money that will move on a day the flow vocabulary cannot name —
// a card's due date, the school's own months, the salary of the last
// workday. The calendar and the forecast are two questions about the same
// events; a sum nobody knows counts as nothing rather than as a guess.

export type BillScheduleRead = Schemas["BillScheduleRead"];
export type BillScheduleCreate = Schemas["BillScheduleCreate"];
export type BillScheduleUpdate = Schemas["BillScheduleUpdate"];
export type CalendarPage = Schemas["CalendarPage"];
export type CalendarMovement = Schemas["CalendarMovement"];
export type CashForecast = Schemas["CashForecast"];
export type ForecastAccount = Schemas["ForecastAccount"];
export type ForecastGap = Schemas["ForecastGap"];
export type CoverOption = Schemas["CoverOption"];
export type UpcomingBill = Schemas["UpcomingBill"];

// GET /api/bills — every bill the calendar knows, oldest first.
export async function getBills(): Promise<BillScheduleRead[]> {
  return (await api.get<BillScheduleRead[]>("/api/bills")).data;
}

// POST /api/bills — tell the calendar about a bill.
export async function createBill(data: BillScheduleCreate): Promise<BillScheduleRead> {
  return (await api.post<BillScheduleRead>("/api/bills", data)).data;
}

// PATCH /api/bills/{id} — change a bill's habits.
export async function updateBill(id: number, data: BillScheduleUpdate): Promise<BillScheduleRead> {
  return (await api.patch<BillScheduleRead>(`/api/bills/${id}`, data)).data;
}

// DELETE /api/bills/{id}
export async function deleteBill(id: number): Promise<void> {
  await api.delete(`/api/bills/${id}`);
}

// GET /api/calendar?month=YYYY-MM — the month's expected movements by day.
export async function getCalendar(month?: string): Promise<CalendarPage> {
  return (await api.get<CalendarPage>("/api/calendar", { params: month ? { month } : {} })).data;
}

// GET /api/forecast?days=30 — every account's balance for the days ahead,
// and where one runs thin (with what got it there and who could cover).
export async function getForecast(days: number = 30): Promise<CashForecast> {
  return (await api.get<CashForecast>("/api/forecast", { params: { days } })).data;
}

// GET /api/bills/upcoming?within=7 — what is due soon, each with whether the
// account holds enough for it today.
export async function getUpcomingBills(within: number = 7): Promise<UpcomingBill[]> {
  return (await api.get<UpcomingBill[]>("/api/bills/upcoming", { params: { within } })).data;
}
