import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/roshdyar/format";
import { useWorkspace } from "@/lib/roshdyar/use-workspace";

export const Route = createFileRoute("/automations")({ component: Page });

function Page() {
  return (
    <AppShell>
      <Rules />
    </AppShell>
  );
}

function Rules() {
  const ws = useWorkspace();
  const canEdit = ws.me.role === "owner" || ws.me.role === "manager";
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="اتوماسیون" description="قانون ارسال پیشنهاد هنگام خود ارسال اجرا می‌شود و با کلید یکتا از وظیفه تکراری جلوگیری می‌کند. خاموش کردن قانون، تاریخچه را پاک نمی‌کند." />
      <div className="grid gap-3">
        {ws.automations.map((rule) => (
          <Card key={rule.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">{rule.name}</h2>
                <p className="mt-1 text-sm text-muted">{rule.description}</p>
                <p className="mt-2 text-xs text-faint">تأخیر {rule.delayDays.toLocaleString("fa-IR")} روز · {rule.trigger === "quote.sent" ? "رویداد: پیشنهاد ارسال شد" : "رویداد: فرصت راکد"}</p>
              </div>
              <Badge tone={rule.enabled ? "good" : "neutral"}>{rule.enabled ? "روشن" : "خاموش"}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {canEdit ? <Button variant="quiet" onClick={() => ws.toggleAutomation(rule.id)}>{rule.enabled ? "خاموش کردن" : "روشن کردن"}</Button> : null}
              {rule.trigger === "opportunity.stale" ? (
                <Button onClick={() => {
                  const res = ws.runStaleRule();
                  if (!res.ok) toast.error(res.message);
                  else toast.success(res.created ? `${res.created.toLocaleString("fa-IR")} وظیفه جدید` : "وظیفه تکراری ساخته نشد");
                }}>اجرای اکنون</Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
      <h2 className="mb-3 mt-8 font-bold">اجراها</h2>
      <ul className="grid gap-2">
        {ws.automationRuns.map((run) => (
          <li key={run.id} className="rounded-lg border border-line px-3 py-3 text-sm">
            <span className="text-faint">{formatDate(run.at)}</span> · {run.summary}
          </li>
        ))}
      </ul>
    </div>
  );
}
