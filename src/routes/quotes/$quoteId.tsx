import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { QuotePaper } from "@/components/quote-paper";
import { Badge, Button, Field, fieldClass } from "@/components/ui";
import { draftFollowUp } from "@/lib/roshdyar/ai";
import { formatDate } from "@/lib/roshdyar/format";
import { PLAN, effectiveQuoteStatus } from "@/lib/roshdyar/metrics";
import { QUOTE_STATUS, type QuoteItem } from "@/lib/roshdyar/types";
import { useWorkspace } from "@/lib/roshdyar/use-workspace";

export const Route = createFileRoute("/quotes/$quoteId")({ component: Page });

function Page() {
  const { quoteId } = Route.useParams();
  return (
    <AppShell>
      <Editor id={quoteId} />
    </AppShell>
  );
}

function Editor({ id }: { id: string }) {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const quote = ws.quotes.find((q) => q.id === id);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [tone, setTone] = useState("محترمانه و کوتاه");
  if (!quote) return <p className="text-muted">پیشنهاد پیدا نشد.</p>;
  const customer = ws.allCustomers.find((c) => c.id === quote.customerId);
  const status = effectiveQuoteStatus(quote);
  const locked = quote.status !== "DRAFT" && quote.status !== "PENDING_APPROVAL";
  const cap = ws.org.discountCaps[ws.me.role] ?? 0;
  const over = quote.discountPercent > cap;

  function patch(partial: Parameters<typeof ws.updateQuote>[1]) {
    const res = ws.updateQuote(id, partial);
    if (!res.ok) toast.error(res.message);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/quotes" className="text-sm text-muted">همه پیشنهادها</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{quote.number}</h1>
          <p className="text-sm text-muted">{customer?.name} · مالیات {quote.taxPercent.toLocaleString("fa-IR")}٪ روی مبلغ پس از تخفیف، ثابتِ همین نسخه</p>
        </div>
        <Badge tone={status === "ACCEPTED" ? "good" : status === "REJECTED" || status === "EXPIRED" ? "bad" : status === "PENDING_APPROVAL" ? "warn" : "neutral"}>{QUOTE_STATUS[status]}</Badge>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="grid content-start gap-3">
          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="font-bold">ردیف‌ها</h2>
            <div className="mt-3 grid gap-3">
              {quote.items.map((item, index) => (
                <div key={item.id} className="grid gap-2 rounded-lg border border-line p-3">
                  <input className={fieldClass} disabled={locked} value={item.title} onChange={(e) => patch({ items: replace(quote.items, index, { ...item, title: e.target.value }) })} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={fieldClass} dir="ltr" type="number" disabled={locked} value={item.qty} onChange={(e) => patch({ items: replace(quote.items, index, { ...item, qty: Number(e.target.value) }) })} />
                    <input className={fieldClass} dir="ltr" type="number" disabled={locked} value={item.unitPrice} onChange={(e) => patch({ items: replace(quote.items, index, { ...item, unitPrice: Number(e.target.value) }) })} />
                  </div>
                  {!locked ? <button className="text-start text-xs text-bad" onClick={() => patch({ items: quote.items.filter((row) => row.id !== item.id) })}>حذف ردیف</button> : null}
                </div>
              ))}
            </div>
            {!locked ? (
              <div className="mt-3 grid gap-2">
                <select
                  className={fieldClass}
                  defaultValue=""
                  onChange={(e) => {
                    const service = ws.services.find((s) => s.id === e.target.value);
                    e.target.value = "";
                    if (!service) return;
                    const item: QuoteItem = { id: crypto.randomUUID(), serviceId: service.id, title: service.name, qty: 1, unitPrice: service.price, unit: service.unit };
                    patch({ items: [...quote.items, item] });
                  }}
                >
                  <option value="">افزودن از کاتالوگ</option>
                  {ws.services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <Button variant="quiet" onClick={() => patch({ items: [...quote.items, { id: crypto.randomUUID(), title: "ردیف سفارشی", qty: 1, unitPrice: 0, unit: "مورد" }] })}>ردیف سفارشی</Button>
              </div>
            ) : null}
          </section>
          <section className="rounded-card border border-line bg-surface p-4">
            <Field label={`تخفیف درصدی · سقف نقش شما ${cap.toLocaleString("fa-IR")}٪`}>
              <input className={fieldClass} dir="ltr" type="number" disabled={locked} value={quote.discountPercent} onChange={(e) => patch({ discountPercent: Number(e.target.value) })} />
            </Field>
            {over && !locked ? <p className="mt-2 text-sm text-primary">بالاتر از سقف است. ارسال، پیشنهاد را برای تأیید مدیر نگه می‌دارد.</p> : null}
            <Field label="توضیح برای مشتری">
              <textarea className={`${fieldClass} mt-3 h-24 py-2`} disabled={locked} value={quote.notes} onChange={(e) => patch({ notes: e.target.value })} />
            </Field>
            <p className="mt-3 text-xs text-faint">اعتبار تا {formatDate(quote.validUntil)}. تغییر کاتالوگ، قیمت همین نسخه را عوض نمی‌کند.</p>
          </section>
          <div className="flex flex-wrap gap-2">
            {!locked && ws.can("quotes.send") ? (
              <Button onClick={() => {
                const res = ws.sendQuote(id);
                if (!res.ok) toast.error(res.message);
                else toast.success(res.status === "PENDING_APPROVAL" ? "برای تأیید مدیر رفت" : "ارسال شد و در صورت فعال بودن قانون، پیگیری زمان‌بندی شد");
              }}>{over && !ws.can("quotes.discount.approve") ? "ارسال برای تأیید" : quote.status === "PENDING_APPROVAL" ? "تأیید و ارسال" : "ارسال پیشنهاد"}</Button>
            ) : null}
            {["SENT", "VIEWED", "REJECTED", "EXPIRED"].includes(status) && ws.can("quotes.create") ? (
              <Button variant="quiet" onClick={() => {
                const res = ws.reviseQuote(id);
                if (!res.ok) toast.error(res.message);
                else {
                  toast.success("نسخه جدید ساخته شد. نسخه قبلی تا ارسال نسخه جدید سر جایش می‌ماند.");
                  void navigate({ to: "/quotes/$quoteId", params: { quoteId: res.id } });
                }
              }}>نسخه اصلاحی</Button>
            ) : null}
            {!["ACCEPTED", "CANCELLED", "SUPERSEDED"].includes(status) && ws.can("quotes.send") ? (
              <Button variant="ghost" onClick={() => {
                const res = ws.cancelQuote(id);
                if (!res.ok) toast.error(res.message);
                else toast.success("لغو شد");
              }}>لغو</Button>
            ) : null}
            <Link to="/q/$token" params={{ token: quote.token }} className="inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm">نمای مشتری</Link>
          </div>
          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="font-bold">پیش‌نویس پیام پیگیری</h2>
            <p className="mt-1 text-xs text-muted">دستیار قیمت نمی‌سازد. متن را قبل از ارسال به مشتری بخوانید. سقف این پیش‌نمایش {PLAN.previewAiCap.toLocaleString("fa-IR")} بار است.</p>
            <select className={`${fieldClass} mt-3`} value={tone} onChange={(e) => setTone(e.target.value)}>
              <option>محترمانه و کوتاه</option>
              <option>صمیمی</option>
              <option>رسمی</option>
            </select>
            <Button className="mt-3" variant="quiet" disabled={busy} onClick={() => void ask()}>
              {busy ? "در حال نوشتن" : "نوشتن دو نسخه"}
            </Button>
            {draft ? <pre className="mt-3 whitespace-pre-wrap text-sm leading-7">{draft}</pre> : null}
          </section>
          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="font-bold">رویدادها</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {ws.quoteEvents.filter((e) => e.quoteId === id).map((e) => (
                <li key={e.id}>
                  <span className="text-muted">{formatDate(e.at)}</span> · {e.type} {e.note ? `· ${e.note}` : ""}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <QuotePaper org={ws.org} customer={customer} quote={quote} />
      </div>
    </div>
  );

  async function ask() {
    if (ws.aiUses >= PLAN.previewAiCap) {
      toast.error("سقف آزمایش دستیار در این پیش‌نمایش پر شده است.");
      return;
    }
    setBusy(true);
    try {
      const res = await draftFollowUp({
        data: {
          customer: customer?.name ?? "مشتری",
          tone,
          context: `شماره ${quote?.number}. وضعیت ${quote ? QUOTE_STATUS[effectiveQuoteStatus(quote)] : ""}. خدمت‌ها: ${quote?.items.map((i) => i.title).join("، ")}. توضیح: ${quote?.notes || "ندارد"}`,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      ws.recordAiUse();
      setDraft(res.text);
    } finally {
      setBusy(false);
    }
  }
}

function replace(items: QuoteItem[], index: number, next: QuoteItem) {
  return items.map((item, i) => (i === index ? next : item));
}
