import { isBeforeToday, isSameTehranDay, tehranMonthKey } from "./format";
import { quoteTotals } from "./money";
import type { Opportunity, Quote, QuoteStatus, StageId, Task } from "./types";
import { OPEN_STAGES } from "./types";

export const PLAN = {
  name: "رشد",
  price: 4_900_000,
  members: 8,
  customers: 300,
  quotesPerMonth: 40,
  ai: 30,
  previewAiCap: 6,
};

export function isOpenStage(stage: StageId) {
  return OPEN_STAGES.includes(stage);
}

export function effectiveQuoteStatus(quote: Quote, now = Date.now()): QuoteStatus {
  if (
    (quote.status === "SENT" || quote.status === "VIEWED") &&
    new Date(quote.validUntil).getTime() < now
  ) {
    return "EXPIRED";
  }
  return quote.status;
}

export function nominalOpen(opps: Opportunity[]) {
  return opps.filter((o) => isOpenStage(o.stage)).reduce((sum, o) => sum + o.amount, 0);
}

export function weightedOpen(opps: Opportunity[]) {
  return opps
    .filter((o) => isOpenStage(o.stage))
    .reduce((sum, o) => sum + Math.round((o.amount * o.probability) / 100), 0);
}

export function wonRevenue(opps: Opportunity[]) {
  return opps
    .filter((o) => o.stage === "won")
    .reduce((sum, o) => sum + (o.finalAmount ?? o.amount), 0);
}

export function isTaskOpen(task: Task) {
  return task.status === "OPEN" || task.status === "IN_PROGRESS";
}

export function isOverdue(task: Task) {
  return isTaskOpen(task) && isBeforeToday(task.dueAt);
}

export function isDueToday(task: Task) {
  return isTaskOpen(task) && isSameTehranDay(task.dueAt, 0);
}

export function isUpcoming(task: Task) {
  return isTaskOpen(task) && !isBeforeToday(task.dueAt) && !isSameTehranDay(task.dueAt, 0);
}

export type QuoteConversion = {
  accepted: number;
  decided: number;
  rate: number | null;
};

/** Accepted ÷ quotes with a final outcome. Open quotes stay out of the denominator. */
export function quoteConversion(quotes: Quote[]): QuoteConversion {
  const decided = quotes.filter((q) => {
    const status = effectiveQuoteStatus(q);
    return status === "ACCEPTED" || status === "REJECTED" || status === "EXPIRED";
  });
  const accepted = decided.filter((q) => effectiveQuoteStatus(q) === "ACCEPTED").length;
  return {
    accepted,
    decided: decided.length,
    rate: decided.length === 0 ? null : accepted / decided.length,
  };
}

export function quotesThisMonth(quotes: Quote[]) {
  const month = tehranMonthKey(new Date());
  return quotes.filter((q) => tehranMonthKey(q.createdAt) === month).length;
}

export function awaitingQuotes(quotes: Quote[]) {
  return quotes.filter((q) => {
    const status = effectiveQuoteStatus(q);
    return status === "SENT" || status === "VIEWED";
  });
}

export function isStale(opp: Opportunity, staleDays: number) {
  if (!isOpenStage(opp.stage)) return false;
  const entered = new Date(opp.stageEnteredAt).getTime();
  return Date.now() - entered >= staleDays * 86_400_000;
}

export function acceptedQuoteTotal(quotes: Quote[]) {
  return quotes
    .filter((q) => q.status === "ACCEPTED")
    .reduce((sum, q) => sum + quoteTotals(q).total, 0);
}
