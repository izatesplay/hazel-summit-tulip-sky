import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Money } from "@/components/ui";
import { daysSince, formatDate, formatTodayLabel } from "@/lib/roshdyar/format";
import { awaitingQuotes, isDueToday, isOverdue, isStale, nominalOpen, weightedOpen, wonRevenue } from "@/lib/roshdyar/metrics";
import { memberName, useWorkspace } from "@/lib/roshdyar/use-workspace";
import { STAGES } from "@/lib/roshdyar/types";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  return (
    <AppShell>
      <Home />
    </AppShell>
  );
}

function Home() {
  const ws = useWorkspace();
  const today = ws.tasks.filter(isDueToday);
  const overdue = ws.tasks.filter(isOverdue);
  const waiting = awaitingQuotes(ws.quotes);
  const stale = ws.opportunities.filter((o) => isStale(o, ws.org.staleDays));
  const pending = ws.quotes.filter((q) => q.status === "PENDING_APPROVAL");
  const nominal = nominalOpen(ws.opportunities);
  const weighted = weightedOpen(ws.opportunities);
  const openCount = ws.opportunities.filter((o) => o.stage !== "won" && o.stage !== "lost");
  const maxStage = Math.max(1, ...STAGES.filter((s) => s.kind === "open").map((s) => ws.opportunities.filter((o) => o.stage === s.id).length));

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm text-muted">{formatTodayLabel()}</p>
      <h1 className="mt-1 text-balance text-3xl font-extrabold">سلام، {ws.me.name.split(" ")[0]}</h1>
      <p className="mt-2 max-w-2xl text-pretty text-sm text-muted">
        برآورد وزنی فروش باز {openCount.length.toLocaleString("fa-IR")} فرصت است. این عدد درآمد قطعی یا مبلغ وصول‌شده نیست.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="برآورد وزنی" value={weighted} hint="مبلغ × احتمال · نه درآمد قطعی" accent />
        <Kpi label="مبلغ اسمی باز" value={nominal} hint="جمع فرصت‌های هنوز باز" />
        <Kpi label="پیشنهاد بی‌پاسخ" value={waiting.length} hint="ارسال‌شده یا دیده‌شده، هنوز نهایی نشده" plain />
        <Kpi label="پیگیری عقب‌افتاده" value={overdue.length} hint="سررسید گذشته و هنوز باز" plain warn={overdue.length > 0} />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <h2 className="font-bold">کارهای امروز</h2>
          <ul className="mt-3 divide-y divide-line">
            {today.length === 0 ? <li className="py-6 text-sm text-muted">برای امروز وظیفه بازی نمانده.</li> : null}
            {today.map((task) => (
              <li key={task.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted">
                    {memberName(ws.members, task.assigneeId)}
                    {task.customerId ? ` · ${ws.allCustomers.find((c) => c.id === task.customerId)?.name ?? ""}` : ""}
                  </p>
                </div>
                <Badge tone={task.priority === "high" ? "warn" : "neutral"}>{task.status === "IN_PROGRESS" ? "در حال انجام" : "باز"}</Badge>
              </li>
            ))}
          </ul>
          <Link to="/tasks" className="mt-2 inline-block text-sm text-primary">همه پیگیری‌ها</Link>
        </Card>
        <Card>
          <h2 className="font-bold">فروش در خطر</h2>
          <ul className="mt-3 space-y-3">
            {stale.map((o) => (
              <li key={o.id}>
                <Link to="/pipeline" className="block">
                  <p className="font-medium">{o.title}</p>
                  <p className="text-xs text-bad">{daysSince(o.stageEnteredAt).toLocaleString("fa-IR")} روز در همین مرحله</p>
                </Link>
              </li>
            ))}
            {pending.map((q) => (
              <li key={q.id}>
                <Link to="/quotes/$quoteId" params={{ quoteId: q.id }} className="block">
                  <p className="font-medium">تخفیف {q.number} منتظر تأیید</p>
                  <p className="text-xs text-primary">{q.discountPercent.toLocaleString("fa-IR")} درصد</p>
                </Link>
              </li>
            ))}
            {overdue.slice(0, 3).map((t) => (
              <li key={t.id}>
                <p className="font-medium">{t.title}</p>
                <p className="text-xs text-bad">سررسید {formatDate(t.dueAt)}</p>
              </li>
            ))}
            {stale.length + pending.length + overdue.length === 0 ? <li className="text-sm text-muted">مورد حادی در محدوده دسترسی شما نیست.</li> : null}
          </ul>
        </Card>
      </div>
      <Card className="mt-3">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="font-bold">قیف، به تعداد فرصت</h2>
          <p className="text-xs text-faint">فروش ثبت‌شده: <Money value={wonRevenue(ws.opportunities)} short /></p>
        </div>
        <div className="grid gap-2">
          {STAGES.filter((s) => s.kind === "open").map((stage) => {
            const rows = ws.opportunities.filter((o) => o.stage === stage.id);
            return (
              <div key={stage.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                <span className="truncate text-muted">{stage.label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-raised">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(rows.length / maxStage) * 100}%` }} />
                </span>
                <span className="tabular-nums text-faint">{rows.length.toLocaleString("fa-IR")}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value, hint, accent, plain, warn }: { label: string; value: number; hint: string; accent?: boolean; plain?: boolean; warn?: boolean }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-3xl font-extrabold tabular-nums ${warn ? "text-bad" : accent ? "text-primary" : "text-fg"}`}>
        {plain ? value.toLocaleString("fa-IR") : <Money value={value} short />}
      </p>
      <p className="mt-1 text-xs text-faint">{hint}</p>
    </Card>
  );
}
