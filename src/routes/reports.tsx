import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { Card, PageHeader } from "@/components/ui";
import { formatTomanShort } from "@/lib/roshdyar/format";
import { acceptedQuoteTotal, quoteConversion, wonRevenue } from "@/lib/roshdyar/metrics";
import { SOURCES, STAGES } from "@/lib/roshdyar/types";
import { memberName, useWorkspace } from "@/lib/roshdyar/use-workspace";

export const Route = createFileRoute("/reports")({ component: Page });

function Page() {
  return (
    <AppShell>
      <Reports />
    </AppShell>
  );
}

function Reports() {
  const ws = useWorkspace();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const conv = quoteConversion(ws.quotes);
  const funnel = STAGES.map((stage) => ({
    name: stage.label,
    count: ws.opportunities.filter((o) => o.stage === stage.id).length,
    amount: ws.opportunities.filter((o) => o.stage === stage.id).reduce((s, o) => s + (o.finalAmount ?? o.amount), 0),
  }));
  const sources = SOURCES.map((source) => ({
    name: source,
    count: ws.customers.filter((c) => c.source === source && c.status !== "ARCHIVED").length,
  })).filter((s) => s.count > 0);
  const reps = ws.members.filter((m) => ["owner", "manager", "sales"].includes(m.role)).map((m) => {
    const opps = ws.opportunities.filter((o) => o.assigneeId === m.id);
    const open = opps.filter((o) => o.stage !== "won" && o.stage !== "lost");
    return {
      id: m.id,
      name: m.name,
      open: open.length,
      nominal: open.reduce((s, o) => s + o.amount, 0),
      won: opps.filter((o) => o.stage === "won").reduce((s, o) => s + (o.finalAmount ?? 0), 0),
      late: ws.tasks.filter((t) => t.assigneeId === m.id && (t.status === "OPEN" || t.status === "IN_PROGRESS") && new Date(t.dueAt).getTime() < Date.now() - 86_400_000).length,
    };
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="گزارش فروش" description="بازه‌ها با منطقه زمانی تهران حساب می‌شوند. فروش ثبت‌شده با مبلغ پیشنهاد پذیرفته‌شده یکی نیست." />
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">فروش ثبت‌شده</p>
          <p className="mt-2 text-2xl font-extrabold">{formatTomanShort(wonRevenue(ws.opportunities))} <span className="text-sm font-normal text-muted">تومان</span></p>
          <p className="mt-1 text-xs text-faint">جمع مبلغ نهایی فرصت‌های فروش موفق</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">پیشنهاد پذیرفته‌شده</p>
          <p className="mt-2 text-2xl font-extrabold">{formatTomanShort(acceptedQuoteTotal(ws.quotes))} <span className="text-sm font-normal text-muted">تومان</span></p>
          <p className="mt-1 text-xs text-faint">جمع قابل‌پرداخت پیشنهادهای پذیرفته، نه وصول</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">نرخ تبدیل پیشنهاد</p>
          <p className="mt-2 text-2xl font-extrabold">{conv.rate === null ? "—" : `${Math.round(conv.rate * 100).toLocaleString("fa-IR")}٪`}</p>
          <p className="mt-1 text-xs text-faint">{conv.accepted.toLocaleString("fa-IR")} از {conv.decided.toLocaleString("fa-IR")} پیشنهاد با نتیجه نهایی</p>
        </Card>
      </div>
      <Card className="mt-3">
        <h2 className="mb-3 font-bold">تعداد فرصت در هر مرحله</h2>
        <div className="h-72" dir="ltr">
          {ready ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel}>
                <CartesianGrid stroke="#343d2e" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#a89f8c", fontSize: 11 }} interval={0} angle={-25} height={70} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fill: "#a89f8c", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1c2118", border: "1px solid #343d2e", borderRadius: 12, color: "#f3ecdc" }} />
                <Bar dataKey="count" fill="#e2a322" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </Card>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">منبع جذب مشتری</h2>
          <div className="h-56" dir="ltr">
            {ready ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sources}>
                  <XAxis dataKey="name" tick={{ fill: "#a89f8c", fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "#a89f8c", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#1c2118", border: "1px solid #343d2e", color: "#f3ecdc" }} />
                  <Bar dataKey="count" fill="#8faf82" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">کارشناسان</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-faint">
                <tr>
                  <th className="py-2 text-start font-medium">نام</th>
                  <th className="py-2 text-start font-medium">باز</th>
                  <th className="py-2 text-start font-medium">اسمی</th>
                  <th className="py-2 text-start font-medium">موفق</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((rep) => (
                  <tr key={rep.id} className="border-t border-line">
                    <td className="py-2">{memberName(ws.members, rep.id)}</td>
                    <td className="py-2 tabular-nums">{rep.open.toLocaleString("fa-IR")}</td>
                    <td className="py-2">{formatTomanShort(rep.nominal)}</td>
                    <td className="py-2">{formatTomanShort(rep.won)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-faint">نرخ تبدیل فقط پیشنهادهای پذیرفته، ردشده یا منقضی را در مخرج می‌گذارد. پیش‌نویس و موارد هنوز باز داخل مخرج نیستند.</p>
        </Card>
      </div>
    </div>
  );
}
