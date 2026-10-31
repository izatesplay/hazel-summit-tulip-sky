import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button, Field, PageHeader, fieldClass } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/roshdyar/types";
import { useWorkspace } from "@/lib/roshdyar/use-workspace";

export const Route = createFileRoute("/settings")({ component: Page });

function Page() {
  return (
    <AppShell>
      <Settings />
    </AppShell>
  );
}

function Settings() {
  const ws = useWorkspace();
  const [name, setName] = useState(ws.org.name);
  const [phone, setPhone] = useState(ws.org.phone);
  const [address, setAddress] = useState(ws.org.address);
  const [tax, setTax] = useState(ws.org.taxPercent);
  const [follow, setFollow] = useState(ws.org.followUpDays);
  const [stale, setStale] = useState(ws.org.staleDays);
  const [prefix, setPrefix] = useState(ws.org.quotePrefix);
  const [salesCap, setSalesCap] = useState(ws.org.discountCaps.sales);
  const locked = !ws.can("settings.manage");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="تنظیمات سازمان" description="منطقه زمانی تهران است. مالیات روی پیشنهادهای قبلی اثر نمی‌گذارد چون درصد روی همان نسخه ذخیره شده." />
      <div className="grid gap-3 rounded-card border border-line bg-surface p-4">
        <Field label="نام سازمان"><input className={fieldClass} disabled={locked} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="تلفن"><input className={fieldClass} dir="ltr" disabled={locked} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="نشانی"><input className={fieldClass} disabled={locked} value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="مالیات درصد"><input className={fieldClass} dir="ltr" type="number" disabled={locked} value={tax} onChange={(e) => setTax(Number(e.target.value))} /></Field>
          <Field label="پیشوند شماره پیشنهاد"><input className={fieldClass} dir="ltr" disabled={locked} value={prefix} onChange={(e) => setPrefix(e.target.value)} /></Field>
          <Field label="پیگیری بعد از ارسال، روز"><input className={fieldClass} dir="ltr" type="number" disabled={locked} value={follow} onChange={(e) => setFollow(Number(e.target.value))} /></Field>
          <Field label="راکد شدن فرصت، روز"><input className={fieldClass} dir="ltr" type="number" disabled={locked} value={stale} onChange={(e) => setStale(Number(e.target.value))} /></Field>
        </div>
        <Field label={`سقف تخفیف ${ROLE_LABEL.sales}`}>
          <input className={fieldClass} dir="ltr" type="number" disabled={locked} value={salesCap} onChange={(e) => setSalesCap(Number(e.target.value))} />
        </Field>
        <p className="text-xs text-faint">پیامک و ایمیل از طریق آداپتر جدا وصل می‌شوند و الآن به ارائه‌دهنده‌ای متصل نیستند. تغییر ارائه‌دهنده نباید منطق فروش را عوض کند.</p>
        {!locked ? (
          <Button onClick={() => {
            const res = ws.updateOrg({
              name, phone, address, taxPercent: tax, followUpDays: follow, staleDays: stale, quotePrefix: prefix.trim() || "AVN",
              discountCaps: { ...ws.org.discountCaps, sales: salesCap },
            });
            if (!res.ok) toast.error(res.message);
            else toast.success("ذخیره شد");
          }}>ذخیره</Button>
        ) : <p className="text-sm text-muted">این نقش فقط تنظیمات را می‌بیند.</p>}
      </div>
      <section className="mt-4 rounded-card border border-line p-4">
        <h2 className="font-bold">داده نمونه</h2>
        <p className="mt-1 text-sm text-muted">اگر مسیر را عوض کردید و می‌خواهید داستان اولیه آوان راهبرد برگردد.</p>
        <Button className="mt-3" variant="quiet" onClick={() => { ws.reset(); toast.success("داده نمونه برگشت"); }}>بازگشت به داده نمونه</Button>
      </section>
    </div>
  );
}
