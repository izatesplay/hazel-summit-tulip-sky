import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QuotePaper } from "@/components/quote-paper";
import { Button, fieldClass } from "@/components/ui";
import { effectiveQuoteStatus } from "@/lib/roshdyar/metrics";
import { QUOTE_STATUS } from "@/lib/roshdyar/types";
import { useRoshdyar } from "@/lib/roshdyar/store";

export const Route = createFileRoute("/q/$token")({ component: PublicQuote });

function PublicQuote() {
  const { token } = Route.useParams();
  const quote = useRoshdyar((s) => s.quotes.find((q) => q.token === token));
  const customer = useRoshdyar((s) => s.customers.find((c) => c.id === quote?.customerId));
  const org = useRoshdyar((s) => s.org);
  const markViewed = useRoshdyar((s) => s.markViewed);
  const respond = useRoshdyar((s) => s.respondQuote);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    markViewed(token);
  }, [token, markViewed]);

  if (!quote) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-xl font-bold">این پیوند پیدا نشد</p>
        <p className="mt-2 text-sm text-muted">ممکن است پیشنهاد حذف یا جایگزین شده باشد.</p>
      </main>
    );
  }

  const status = effectiveQuoteStatus(quote);
  const closed = ["ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED", "SUPERSEDED", "DRAFT", "PENDING_APPROVAL"].includes(status);
  const terminal = status === "ACCEPTED" || status === "REJECTED";

  function act(decision: "accept" | "reject" | "comment") {
    const res = respond(token, decision, note);
    setMessage(res.ok ? (decision === "accept" ? "پذیرش ثبت شد. این به معنی پرداخت یا قرارداد نهایی نیست." : decision === "reject" ? "پاسخ شما ثبت شد." : "توضیح برای سازمان فرستاده شد.") : res.message);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <p className="no-print mb-4 text-sm text-muted">نمای مشتری · بدون ورود به پنل</p>
      <QuotePaper org={org} customer={customer} quote={quote} />
      <section className="no-print mt-4 rounded-card border border-line bg-surface p-4">
        {terminal ? <p className="font-semibold">پاسخ شما ثبت شده: {QUOTE_STATUS[status]}</p> : null}
        {status === "EXPIRED" ? <p className="font-semibold text-bad">اعتبار این پیشنهاد تمام شده است.</p> : null}
        {status === "CANCELLED" || status === "SUPERSEDED" ? <p>این نسخه دیگر فعال نیست.</p> : null}
        {quote.responseNote ? <p className="mt-2 text-sm text-muted">{quote.responseNote}</p> : null}
        {!closed ? (
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted">توضیح، اگر لازم است</span>
              <textarea className={`${fieldClass} h-24 py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => act("accept")}>می‌پذیرم</Button>
              <Button variant="quiet" onClick={() => act("reject")}>نمی‌پذیرم</Button>
              <Button variant="ghost" onClick={() => act("comment")}>درخواست اصلاح</Button>
            </div>
          </div>
        ) : null}
        {message ? <p className="mt-3 text-sm">{message}</p> : null}
        <button className="mt-4 text-sm text-muted" onClick={() => window.print()}>چاپ یا ذخیره PDF</button>
      </section>
      <p className="no-print mt-6 text-center text-xs text-faint">
        <Link to="/" className="text-muted">بازگشت به پنل سازمان</Link>
      </p>
    </main>
  );
}
