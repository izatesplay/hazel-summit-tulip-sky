import { formatDate, formatToman } from "@/lib/roshdyar/format";
import { quoteTotals } from "@/lib/roshdyar/money";
import { effectiveQuoteStatus } from "@/lib/roshdyar/metrics";
import { QUOTE_STATUS, type Customer, type Org, type Quote } from "@/lib/roshdyar/types";

export function QuotePaper({ org, customer, quote }: { org: Org; customer?: Customer; quote: Quote }) {
  const totals = quoteTotals(quote);
  const status = effectiveQuoteStatus(quote);
  return (
    <article className="quote-paper rounded-card bg-paper p-5 text-paper-ink shadow-none md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-paper-ink/15 pb-4">
        <div>
          <p className="text-xs text-paper-ink/60">پیشنهاد قیمت</p>
          <h2 className="mt-1 text-2xl font-extrabold">{org.name}</h2>
          <p className="mt-1 text-sm text-paper-ink/70">{org.legalName}</p>
          <p className="text-sm text-paper-ink/70">{org.phone} · {org.address}</p>
        </div>
        <div className="text-start">
          <p className="font-bold tabular-nums">{quote.number}</p>
          <p className="mt-1 text-sm">نسخه {quote.version.toLocaleString("fa-IR")}</p>
          <p className="mt-2 inline-block rounded-full bg-paper-ink/10 px-2 py-1 text-xs">{QUOTE_STATUS[status]}</p>
        </div>
      </header>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <p>
          <span className="text-paper-ink/60">برای </span>
          <span className="font-semibold">{customer?.name ?? "مشتری"}</span>
        </p>
        <p>
          <span className="text-paper-ink/60">اعتبار تا </span>
          <span className="font-semibold">{formatDate(quote.validUntil)}</span>
        </p>
      </div>
      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-paper-ink/15 text-paper-ink/60">
            <th className="py-2 text-start font-medium">شرح</th>
            <th className="py-2 text-start font-medium">تعداد</th>
            <th className="py-2 text-start font-medium">فی</th>
            <th className="py-2 text-start font-medium">مبلغ</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((item) => (
            <tr key={item.id} className="border-b border-paper-ink/10">
              <td className="py-2">{item.title}</td>
              <td className="py-2 tabular-nums">{item.qty.toLocaleString("fa-IR")} {item.unit}</td>
              <td className="py-2 tabular-nums">{formatToman(item.unitPrice)}</td>
              <td className="py-2 tabular-nums">{formatToman(item.qty * item.unitPrice)}</td>
            </tr>
          ))}
          {quote.items.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-6 text-center text-paper-ink/50">هنوز ردیفی اضافه نشده.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <dl className="ms-auto mt-4 grid max-w-xs gap-1 text-sm">
        <Row label="جمع ردیف‌ها" value={totals.subtotal} />
        <Row label={`تخفیف (${totals.percent.toLocaleString("fa-IR")}٪)`} value={totals.discount} />
        <Row label={`مالیات پس از تخفیف (${totals.taxPercent.toLocaleString("fa-IR")}٪)`} value={totals.tax} />
        <div className="mt-1 flex items-center justify-between border-t border-paper-ink/15 pt-2 text-base font-bold">
          <dt>قابل پرداخت</dt>
          <dd className="tabular-nums">{formatToman(totals.total)} تومان</dd>
        </div>
      </dl>
      {quote.notes ? <p className="mt-4 text-sm leading-7">{quote.notes}</p> : null}
      <p className="mt-4 text-xs leading-6 text-paper-ink/70">{quote.terms}</p>
      <p className="mt-4 text-xs text-paper-ink/50">مبلغ‌ها به تومان و با گردکردن ریاضی محاسبه شده‌اند. این برگه فاکتور رسمی مالیاتی نیست.</p>
    </article>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-paper-ink/70">{label}</dt>
      <dd className="tabular-nums">{formatToman(value)}</dd>
    </div>
  );
}
