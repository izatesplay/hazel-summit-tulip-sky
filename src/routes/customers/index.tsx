import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Empty, Field, Modal, PageHeader, fieldClass } from "@/components/ui";
import { CUSTOMER_STATUS, SOURCES, type CustomerStatus } from "@/lib/roshdyar/types";
import { memberName, useWorkspace } from "@/lib/roshdyar/use-workspace";
import { normalizePhone } from "@/lib/roshdyar/format";

export const Route = createFileRoute("/customers/")({ component: Page });

function Page() {
  return (
    <AppShell>
      <Customers />
    </AppShell>
  );
}

function Customers() {
  const ws = useWorkspace();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "ALL">("ALL");
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => {
    return ws.customers.filter((c) => {
      if (status === "ALL" && c.status === "ARCHIVED") return false;
      if (status !== "ALL" && c.status !== status) return false;
      const hay = `${c.name} ${c.phone} ${c.email} ${c.tags.join(" ")}`;
      return hay.includes(q.trim());
    });
  }, [ws.customers, q, status]);

  const dupPhones = new Set<string>();
  const seen = new Map<string, string>();
  for (const c of ws.customers) {
    if (c.status === "ARCHIVED") continue;
    const phone = normalizePhone(c.phone);
    if (!phone) continue;
    if (seen.has(phone)) dupPhones.add(phone);
    seen.set(phone, c.id);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="مشتریان" description="پرونده شرکت یا شخص، جدا از مرحله فرصت فروش. وضعیت مشتری با مرحله قیف یکی گرفته نمی‌شود.">
        {ws.can("customers.create") ? <Button onClick={() => setOpen(true)}>مشتری جدید</Button> : null}
        {ws.can("data.export") ? (
          <Button
            variant="quiet"
            onClick={() => {
              const header = ["نام", "نوع", "تلفن", "ایمیل", "منبع", "وضعیت", "مسئول"];
              const body = rows.map((c) => [c.name, c.kind === "company" ? "شرکت" : "شخص", c.phone, c.email, c.source, CUSTOMER_STATUS[c.status], memberName(ws.members, c.ownerId)]);
              const csv = [header, ...body].map((r) => r.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
              const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "roshdyar-customers.csv";
              a.click();
              URL.revokeObjectURL(url);
              ws.logExport("خروجی مشتریان قابل‌مشاهده");
              toast.success("خروجی گرفته شد و در فعالیت‌ها ثبت شد");
            }}
          >
            خروجی
          </Button>
        ) : null}
      </PageHeader>
      <div className="mb-3 flex flex-col gap-2 md:flex-row">
        <input className={fieldClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام، شماره، ایمیل یا برچسب" />
        <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value as CustomerStatus | "ALL")}>
          <option value="ALL">همه به‌جز بایگانی</option>
          {Object.entries(CUSTOMER_STATUS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
      {dupPhones.size > 0 ? <p className="mb-3 text-sm text-primary">برخی شماره‌ها در بیش از یک پرونده تکرار شده‌اند. ادغام خودکار انجام نمی‌شود.</p> : null}
      {rows.length === 0 ? <Empty title="مشتری‌ای در این نما نیست" body="فیلتر را بردارید یا اگر مجوز دارید پرونده جدید بسازید." /> : null}
      <div className="grid gap-2">
        {rows.map((c) => {
          const dup = dupPhones.has(normalizePhone(c.phone));
          return (
            <Link key={c.id} to="/customers/$customerId" params={{ customerId: c.id }} className="grid gap-2 rounded-card border border-line bg-surface p-4 md:grid-cols-[minmax(0,1.4fr)_auto_auto_auto] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="text-xs text-muted">{c.kind === "company" ? "شرکت" : "شخص"} · {c.source} · {c.phone}</p>
              </div>
              <span className="text-sm text-muted">{memberName(ws.members, c.ownerId)}</span>
              <Badge tone={c.status === "ACTIVE" ? "good" : c.status === "INACTIVE" || c.status === "ARCHIVED" ? "bad" : "neutral"}>{CUSTOMER_STATUS[c.status]}</Badge>
              {dup ? <Badge tone="warn">تکرار احتمالی</Badge> : <span className="hidden md:block" />}
            </Link>
          );
        })}
      </div>
      <NewCustomer open={open} onOpenChange={setOpen} />
    </div>
  );
}

function NewCustomer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const ws = useWorkspace();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"company" | "person">("company");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<string>(SOURCES[0]);
  const [ownerId, setOwnerId] = useState(ws.meId);
  const [dups, setDups] = useState<{ id: string; name: string }[]>([]);

  function submit(force = false) {
    const res = ws.addCustomer(
      { kind, name, phone, email, source, ownerId, status: "NEW", priority: "normal", tags: [], notes: "" },
      force,
    );
    if (!res.ok) {
      setDups(res.duplicates ?? []);
      toast.error(res.message);
      return;
    }
    toast.success("پرونده ساخته شد");
    setDups([]);
    setName("");
    setPhone("");
    setEmail("");
    onOpenChange(false);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="مشتری جدید">
      <div className="grid gap-3">
        <Field label="نام">
          <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="نوع">
            <select className={fieldClass} value={kind} onChange={(e) => setKind(e.target.value as "company" | "person")}>
              <option value="company">شرکت</option>
              <option value="person">شخص</option>
            </select>
          </Field>
          <Field label="منبع جذب">
            <select className={fieldClass} value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="تلفن">
          <input className={fieldClass} dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912..." />
        </Field>
        <Field label="ایمیل">
          <input className={fieldClass} dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="مسئول">
          <select className={fieldClass} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {ws.members.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        {dups.length > 0 ? (
          <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
            <p>تطبیق قوی با شماره یا ایمیل:</p>
            {dups.map((d) => (
              <Link key={d.id} to="/customers/$customerId" params={{ customerId: d.id }} className="mt-1 block text-primary">{d.name}</Link>
            ))}
            <Button className="mt-3" variant="quiet" onClick={() => submit(true)}>ثبت با وجود شباهت</Button>
          </div>
        ) : null}
        <Button onClick={() => submit(false)}>ثبت پرونده</Button>
      </div>
    </Modal>
  );
}
