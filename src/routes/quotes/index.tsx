import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Empty, Field, Modal, PageHeader, fieldClass } from "@/components/ui";
import { formatDate, formatTomanShort } from "@/lib/roshdyar/format";
import { quoteTotals } from "@/lib/roshdyar/money";
import { effectiveQuoteStatus } from "@/lib/roshdyar/metrics";
import { QUOTE_STATUS, type QuoteStatus } from "@/lib/roshdyar/types";
import { useWorkspace } from "@/lib/roshdyar/use-workspace";

export const Route = createFileRoute("/quotes/")({ component: Page });

const FILTERS: { id: "ALL" | QuoteStatus; label: string }[] = [
  { id: "ALL", label: "همه" },
  { id: "DRAFT", label: "پیش‌نویس" },
  { id: "PENDING_APPROVAL", label: "منتظر تأیید" },
  { id: "SENT", label: "ارسال‌شده" },
  { id: "VIEWED", label: "دیده‌شده" },
  { id: "ACCEPTED", label: "پذیرفته" },
  { id: "REJECTED", label: "ردشده" },
  { id: "EXPIRED", label: "منقضی" },
];

function Page() {
  return (
    <AppShell>
      <Quotes />
    </AppShell>
  );
}

function tone(status: QuoteStatus): "neutral" | "good" | "bad" | "warn" {
  if (status === "ACCEPTED") return "good";
  if (status === "REJECTED" || status === "EXPIRED" || status === "CANCELLED") return "bad";
  if (status === "PENDING_APPROVAL" || status === "VIEWED") return "warn";
  return "neutral";
}

function Quotes() {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("ALL");
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState(ws.customers[0]?.id ?? "");
  const rows = ws.quotes.filter((q) => filter === "ALL" || effectiveQuoteStatus(q) === filter);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="پیشنهاد قیمت" description="قیمت، تخفیف و مالیات اینجا از روی ردیف‌ها حساب می‌شود. مبلغ تایپ‌شده مرورگر پذیرفته نمی‌شود.">
        {ws.can("quotes.create") ? <Button onClick={() => setOpen(true)}>پیشنهاد جدید</Button> : null}
      </PageHeader>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((item) => (
          <button key={item.id} onClick={() => setFilter(item.id)} className={`h-10 shrink-0 rounded-full px-3 text-sm ${filter === item.id ? "bg-primary text-primary-ink" : "bg-raised text-muted"}`}>
            {item.label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? <Empty title="پیشنهادی در این فیلتر نیست" body="فیلتر دیگری را انتخاب کنید." /> : null}
      <div className="grid gap-2">
        {rows.map((q) => {
          const status = effectiveQuoteStatus(q);
          const customer = ws.allCustomers.find((c) => c.id === q.customerId);
          return (
            <Link key={q.id} to="/quotes/$quoteId" params={{ quoteId: q.id }} className="grid gap-2 rounded-card border border-line bg-surface p-4 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:items-center">
              <span className="font-semibold tabular-nums">{q.number}</span>
              <span className="truncate text-sm text-muted">{customer?.name} · نسخه {q.version.toLocaleString("fa-IR")}</span>
              <span className="text-sm tabular-nums">{formatTomanShort(quoteTotals(q).total)} تومان</span>
              <span className="flex items-center gap-2">
                <Badge tone={tone(status)}>{QUOTE_STATUS[status]}</Badge>
                <span className="text-xs text-faint">{formatDate(q.createdAt)}</span>
              </span>
            </Link>
          );
        })}
      </div>
      <Modal open={open} onOpenChange={setOpen} title="پیشنهاد از روی پرونده">
        <Field label="مشتری">
          <select className={fieldClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            {ws.customers.filter((c) => c.status !== "ARCHIVED").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Button className="mt-4" onClick={() => {
          const opp = ws.opportunities.find((o) => o.customerId === customerId && o.stage !== "won" && o.stage !== "lost");
          const res = ws.addQuote({ customerId, opportunityId: opp?.id });
          if (!res.ok) toast.error(res.message);
          else {
            setOpen(false);
            void navigate({ to: "/quotes/$quoteId", params: { quoteId: res.id } });
          }
        }}>ساخت پیش‌نویس</Button>
      </Modal>
    </div>
  );
}
