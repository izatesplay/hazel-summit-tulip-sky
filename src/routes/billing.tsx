import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatToman } from "@/lib/roshdyar/format";
import { PLAN, quotesThisMonth } from "@/lib/roshdyar/metrics";
import { useWorkspace } from "@/lib/roshdyar/use-workspace";

export const Route = createFileRoute("/billing")({ component: Page });

function Page() {
  return (
    <AppShell>
      <Billing />
    </AppShell>
  );
}

function Billing() {
  const ws = useWorkspace();
  const members = ws.members.filter((m) => m.active).length + ws.invitations.filter((i) => i.status === "pending").length;
  const customers = ws.allCustomers.filter((c) => c.status !== "ARCHIVED").length;
  const quotes = quotesThisMonth(ws.allQuotes);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="اشتراک رشدیار" description="این اشتراک خود پلتفرم است، نه مبلغ فروش مشتریان سازمان. وضعیت فعلی نمونه فعال است و پرداخت واقعی از این صفحه انجام نمی‌شود." />
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">پلن جاری</p>
            <h2 className="text-2xl font-extrabold">{PLAN.name}</h2>
            <p className="mt-1 text-sm text-muted">{formatToman(PLAN.price)} تومان در ماه، در داده نمونه</p>
          </div>
          <Badge tone="good">فعال</Badge>
        </div>
        <div className="mt-5 grid gap-4">
          <Meter label="اعضا و دعوت‌های باز" used={members} max={PLAN.members} />
          <Meter label="مشتریان فعال" used={customers} max={PLAN.customers} />
          <Meter label="پیشنهاد این ماه" used={quotes} max={PLAN.quotesPerMonth} />
          <Meter label="درخواست دستیار در این پیش‌نمایش" used={ws.aiUses} max={PLAN.previewAiCap} />
        </div>
      </Card>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ["جوانه", "۲٬۴۰۰٬۰۰۰", "۳ عضو · ۱۰۰ مشتری"],
          ["رشد", "۴٬۹۰۰٬۰۰۰", "۸ عضو · ۳۰۰ مشتری"],
          ["بیشه", "۹٬۵۰۰٬۰۰۰", "۲۵ عضو · نامحدود نسبی"],
        ].map(([name, price, line]) => (
          <Card key={name} className={name === "رشد" ? "border-primary" : ""}>
            <h3 className="font-bold">{name}</h3>
            <p className="mt-2 text-lg font-semibold tabular-nums">{price}</p>
            <p className="text-sm text-muted">{line}</p>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        در محصول نهایی مبلغ را سرور از پلن خودش حساب می‌کند، بازگشت مرورگر اثبات پرداخت نیست و تکرار callback اشتراک را دوباره تمدید نمی‌کند. درگاه اینجا وصل نیست.
      </p>
      <Card className="mt-4">
        <h2 className="font-bold">فاکتورهای نمونه</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex justify-between gap-3"><span>مهر ۱۴۰۵ · رشد</span><span className="text-good">تسویه نمونه</span></li>
          <li className="flex justify-between gap-3"><span>شهریور ۱۴۰۵ · رشد</span><span className="text-good">تسویه نمونه</span></li>
        </ul>
      </Card>
    </div>
  );
}

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted">{used.toLocaleString("fa-IR")} از {max.toLocaleString("fa-IR")}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-raised">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
