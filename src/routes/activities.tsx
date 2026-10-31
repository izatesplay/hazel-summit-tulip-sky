import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/roshdyar/format";
import { memberName, useWorkspace } from "@/lib/roshdyar/use-workspace";

export const Route = createFileRoute("/activities")({ component: Page });

const KIND: Record<string, string> = { note: "یادداشت", call: "تماس", meeting: "جلسه", system: "سیستم" };

function Page() {
  return (
    <AppShell>
      <Feed />
    </AppShell>
  );
}

function Feed() {
  const ws = useWorkspace();
  const rows = [...ws.activities].sort((a, b) => (a.at < b.at ? 1 : -1));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="فعالیت‌ها" description="تماس، جلسه، یادداشت و اثر کارهای سیستم. تغییر مرحله و ارسال پیشنهاد هم اینجا می‌ماند." />
      <ol className="relative grid gap-4 border-s border-line ps-4">
        {rows.map((item) => {
          const customer = ws.allCustomers.find((c) => c.id === item.customerId);
          return (
            <li key={item.id} className="relative">
              <span className="absolute -start-1 mt-1.5 h-2 w-2 rounded-full bg-primary" />
              <p className="text-xs text-faint">{formatDate(item.at)} · {KIND[item.kind] ?? item.kind} · {memberName(ws.members, item.authorId)}</p>
              <p className="font-semibold">{item.title}</p>
              {customer ? <p className="text-sm text-muted">{customer.name}</p> : null}
              {item.body ? <p className="mt-1 text-sm leading-7 text-muted">{item.body}</p> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
