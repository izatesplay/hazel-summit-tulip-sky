import type { Quote, QuoteItem } from "./types";

export function lineAmount(qty: number, unitPrice: number) {
  const q = Math.max(0, Math.round(qty));
  const p = Math.max(0, Math.round(unitPrice));
  return q * p;
}

export function quoteTotals(quote: Pick<Quote, "items" | "discountPercent" | "taxPercent">) {
  const subtotal = quote.items.reduce((sum, item) => sum + lineAmount(item.qty, item.unitPrice), 0);
  const percent = Math.min(100, Math.max(0, Math.round(quote.discountPercent)));
  const discount = Math.round((subtotal * percent) / 100);
  const after = Math.max(0, subtotal - discount);
  const taxPercent = Math.max(0, Math.round(quote.taxPercent));
  const tax = Math.round((after * taxPercent) / 100);
  return { subtotal, discount, after, tax, total: after + tax, percent, taxPercent };
}

export function blankItem(partial: Partial<QuoteItem> & Pick<QuoteItem, "title">): QuoteItem {
  return {
    id: partial.id ?? crypto.randomUUID(),
    serviceId: partial.serviceId,
    title: partial.title,
    qty: Math.max(1, Math.round(partial.qty ?? 1)),
    unitPrice: Math.max(0, Math.round(partial.unitPrice ?? 0)),
    unit: partial.unit ?? "مورد",
  };
}
