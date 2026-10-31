import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Field, Modal, PageHeader, fieldClass } from "@/components/ui";
import { formatToman } from "@/lib/roshdyar/format";
import { useWorkspace } from "@/lib/roshdyar/use-workspace";

export const Route = createFileRoute("/services")({ component: Page });

function Page() {
  return (
    <AppShell>
      <Catalog />
    </AppShell>
  );
}

function Catalog() {
  const ws = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState(50_000_000);
  const [unit, setUnit] = useState("پروژه");
  const canEdit = ws.me.role === "owner" || ws.me.role === "manager";
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="خدمات و قیمت‌ها" description="قیمت کاتالوگ فقط نقطه شروع پیشنهاد است. بعد از افزودن به پیشنهاد، همان عدد روی نسخه می‌ماند حتی اگر کاتالوگ عوض شود.">
        {canEdit ? <Button onClick={() => setOpen(true)}>خدمت جدید</Button> : null}
      </PageHeader>
      <div className="grid gap-2">
        {ws.services.map((service) => (
          <article key={service.id} className="grid gap-2 rounded-card border border-line bg-surface p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
            <div>
              <h2 className="font-semibold">{service.name}</h2>
              <p className="text-sm text-muted">{service.category} · {service.code} · {service.description}</p>
            </div>
            <p className="tabular-nums">{formatToman(service.price)} <span className="text-xs text-faint">تومان / {service.unit}</span></p>
            <div className="flex items-center gap-2">
              <Badge tone={service.active ? "good" : "neutral"}>{service.active ? "فعال" : "غیرفعال"}</Badge>
              {canEdit ? <Button variant="ghost" onClick={() => ws.updateService(service.id, { active: !service.active })}>{service.active ? "توقف" : "فعال‌سازی"}</Button> : null}
            </div>
          </article>
        ))}
      </div>
      <Modal open={open} onOpenChange={setOpen} title="خدمت جدید">
        <div className="grid gap-3">
          <Field label="نام"><input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="قیمت پایه تومان"><input className={fieldClass} dir="ltr" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></Field>
          <Field label="واحد"><input className={fieldClass} value={unit} onChange={(e) => setUnit(e.target.value)} /></Field>
          <Button onClick={() => {
            const res = ws.addService({ name, price, unit, category: "سفارشی", code: "SRV-N", description: "" });
            if (!res.ok) toast.error(res.message);
            else { toast.success("به کاتالوگ اضافه شد"); setOpen(false); setName(""); }
          }}>ثبت</Button>
        </div>
      </Modal>
    </div>
  );
}
