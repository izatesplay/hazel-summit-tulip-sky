import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, Field, Money, fieldClass } from "@/components/ui";
import { formatDate, normalizePhone } from "@/lib/roshdyar/format";
import { effectiveQuoteStatus } from "@/lib/roshdyar/metrics";
import { CUSTOMER_STATUS, QUOTE_STATUS, STAGES, type CustomerStatus } from "@/lib/roshdyar/types";
import { memberName, useWorkspace } from "@/lib/roshdyar/use-workspace";

export const Route = createFileRoute("/customers/$customerId")({ component: Page });

function Page() {
  const { customerId } = Route.useParams();
  return (
    <AppShell>
      <Detail id={customerId} />
    </AppShell>
  );
}

function Detail({ id }: { id: string }) {
  const ws = useWorkspace();
  const customer = ws.allCustomers.find((c) => c.id === id);
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(85_000_000);
  const [contactName, setContactName] = useState("");
  if (!customer || (ws.me.role === "sales" && customer.ownerId !== ws.me.id)) {
    return <p className="text-muted">این پرونده در دسترس شما نیست.</p>;
  }
  const contacts = ws.contacts.filter((c) => c.customerId === id);
  const opps = ws.opportunities.filter((o) => o.customerId === id);
  const quotes = ws.quotes.filter((q) => q.customerId === id);
  const activity = ws.activities.filter((a) => a.customerId === id);
  const phone = normalizePhone(customer.phone);
  const twins = ws.allCustomers.filter((c) => c.id !== id && c.status !== "ARCHIVED" && phone && normalizePhone(c.phone) === phone);

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/customers" className="text-sm text-muted">بازگشت به مشتریان</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">{customer.name}</h1>
          <p className="mt-1 text-sm text-muted">{customer.kind === "company" ? "شرکت" : "شخص"} · {customer.source} · {customer.phone}</p>
        </div>
        <Badge tone={customer.status === "ACTIVE" ? "good" : "neutral"}>{CUSTOMER_STATUS[customer.status]}</Badge>
      </div>
      {twins.length > 0 ? (
        <Card className="mt-4 border-primary/40">
          <p className="font-semibold">احتمال پرونده تکراری</p>
          <p className="mt-1 text-sm text-muted">شماره یکی است. ادغام فقط با تأیید شما انجام می‌شود و سوابق را نگه می‌دارد.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {twins.map((t) => (
              <Button key={t.id} variant="quiet" onClick={() => {
                const res = ws.mergeCustomers(id, t.id);
                if (!res.ok) toast.error(res.message);
                else toast.success("ادغام شد");
              }}>ادغام «{t.name}» در این پرونده</Button>
            ))}
          </div>
        </Card>
      ) : null}
      <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-3">
          <Card>
            <h2 className="font-bold">پرونده</h2>
            <div className="mt-3 grid gap-3">
              <Field label="وضعیت مشتری">
                <select
                  className={fieldClass}
                  value={customer.status}
                  disabled={!ws.can("customers.update")}
                  onChange={(e) => {
                    const res = ws.updateCustomer(id, { status: e.target.value as CustomerStatus });
                    if (!res.ok) toast.error(res.message);
                  }}
                >
                  {Object.entries(CUSTOMER_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </Field>
              <Field label="مسئول">
                <select
                  className={fieldClass}
                  value={customer.ownerId}
                  disabled={!ws.can("customers.update")}
                  onChange={(e) => ws.updateCustomer(id, { ownerId: e.target.value })}
                >
                  {ws.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
              <p className="text-sm text-muted">{customer.notes || "یادداشتی ثبت نشده."}</p>
              <p className="text-xs text-faint">آخرین فعالیت {formatDate(customer.lastActivityAt)}</p>
            </div>
          </Card>
          <Card>
            <h2 className="font-bold">مخاطبان</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {contacts.map((c) => (
                <li key={c.id}>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-muted">{c.roleTitle} · <span dir="ltr">{c.phone}</span></p>
                </li>
              ))}
              {contacts.length === 0 ? <li className="text-muted">مخاطب جداگانه‌ای ثبت نشده.</li> : null}
            </ul>
            {ws.can("customers.update") ? (
              <form className="mt-3 grid gap-2" onSubmit={(e) => {
                e.preventDefault();
                const res = ws.addContact({ customerId: id, name: contactName, roleTitle: "مخاطب", phone: "", email: "" });
                if (!res.ok) toast.error(res.message);
                else setContactName("");
              }}>
                <input className={fieldClass} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="نام مخاطب" />
                <Button type="submit" variant="quiet">افزودن مخاطب</Button>
              </form>
            ) : null}
          </Card>
        </div>
        <div className="grid content-start gap-3">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">فرصت‌های فروش</h2>
            </div>
            <ul className="mt-3 space-y-2">
              {opps.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{o.title}</span>
                  <span className="text-muted">{STAGES.find((s) => s.id === o.stage)?.label} · <Money value={o.finalAmount ?? o.amount} short /></span>
                </li>
              ))}
              {opps.length === 0 ? <li className="text-sm text-muted">فرصتی ثبت نشده.</li> : null}
            </ul>
            {ws.can("opportunities.create") ? (
              <form className="mt-3 grid gap-2 md:grid-cols-[1fr_8rem_auto]" onSubmit={(e) => {
                e.preventDefault();
                const res = ws.addOpportunity({ customerId: id, title, amount: Number(amount), probability: 20, assigneeId: customer.ownerId });
                if (!res.ok) toast.error(res.message);
                else { toast.success("فرصت در مرحله سرنخ جدید ساخته شد"); setTitle(""); }
              }}>
                <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان فرصت" />
                <input className={fieldClass} dir="ltr" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                <Button type="submit">فرصت</Button>
              </form>
            ) : null}
          </Card>
          <Card>
            <h2 className="font-bold">پیشنهادها</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {quotes.map((q) => (
                <li key={q.id}>
                  <Link to="/quotes/$quoteId" params={{ quoteId: q.id }} className="flex items-center justify-between gap-2">
                    <span>{q.number}</span>
                    <span className="text-muted">{QUOTE_STATUS[effectiveQuoteStatus(q)]}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {ws.can("quotes.create") ? (
              <Button className="mt-3" variant="quiet" onClick={() => {
                const res = ws.addQuote({ customerId: id, opportunityId: opps.find((o) => o.stage !== "won" && o.stage !== "lost")?.id });
                if (!res.ok) toast.error(res.message);
                else toast.success("پیش‌نویس ساخته شد. از بخش پیشنهادها بازش کنید.");
              }}>پیش‌نویس پیشنهاد</Button>
            ) : null}
          </Card>
          <Card>
            <h2 className="font-bold">فعالیت</h2>
            {ws.me.role !== "viewer" && ws.me.role !== "finance" ? (
              <form className="mt-3 grid gap-2" onSubmit={(e) => {
                e.preventDefault();
                const res = ws.addNote({ customerId: id, body: note });
                if (!res.ok) toast.error(res.message);
                else setNote("");
              }}>
                <textarea className={`${fieldClass} h-24 py-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="یادداشت داخلی" />
                <Button type="submit" variant="quiet">ثبت یادداشت</Button>
              </form>
            ) : null}
            <ul className="mt-3 space-y-3">
              {activity.map((a) => (
                <li key={a.id}>
                  <p className="text-sm font-medium">{a.title}</p>
                  {a.body ? <p className="text-sm text-muted">{a.body}</p> : null}
                  <p className="text-xs text-faint">{formatDate(a.at)} · {memberName(ws.members, a.authorId)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
