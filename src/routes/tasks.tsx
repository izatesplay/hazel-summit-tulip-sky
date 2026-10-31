import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Empty, Field, Modal, PageHeader, fieldClass } from "@/components/ui";
import { atTehran, formatDate } from "@/lib/roshdyar/format";
import { isDueToday, isOverdue, isUpcoming } from "@/lib/roshdyar/metrics";
import type { Task } from "@/lib/roshdyar/types";
import { memberName, useWorkspace } from "@/lib/roshdyar/use-workspace";

export const Route = createFileRoute("/tasks")({ component: Page });

type Tab = "today" | "overdue" | "next" | "done" | "all";

function Page() {
  return (
    <AppShell>
      <Tasks />
    </AppShell>
  );
}

function Tasks() {
  const ws = useWorkspace();
  const [tab, setTab] = useState<Tab>("today");
  const [doneId, setDoneId] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(ws.meId);
  const [customerId, setCustomerId] = useState("");
  const rows = ws.tasks.filter((task) => {
    if (tab === "today") return isDueToday(task);
    if (tab === "overdue") return isOverdue(task);
    if (tab === "next") return isUpcoming(task);
    if (tab === "done") return task.status === "COMPLETED";
    return true;
  });
  const tabs: { id: Tab; label: string }[] = [
    { id: "today", label: "امروز" },
    { id: "overdue", label: "عقب‌افتاده" },
    { id: "next", label: "آینده" },
    { id: "done", label: "انجام‌شده" },
    { id: "all", label: "همه" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="پیگیری‌ها" description="عقب‌افتادگی وضعیت جداگانه‌ای نیست؛ از مقایسه سررسید با امروز و باز بودن وظیفه به دست می‌آید.">
        {ws.can("tasks.create") ? <Button onClick={() => setOpen(true)}>وظیفه</Button> : null}
      </PageHeader>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {tabs.map((item) => (
          <button key={item.id} className={`h-10 shrink-0 rounded-full px-3 text-sm ${tab === item.id ? "bg-primary text-primary-ink" : "bg-raised text-muted"}`} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      {rows.length === 0 ? <Empty title="موردی در این فهرست نیست" body="یا همه‌چیز به‌روز است، یا این نقش وظیفه‌ای در محدوده خود ندارد." /> : null}
      <div className="grid gap-2">
        {rows.map((task) => <TaskRow key={task.id} task={task} onDone={() => { setDoneId(task.id); setResult(""); }} />)}
      </div>
      <Modal open={Boolean(doneId)} onOpenChange={(v) => !v && setDoneId(null)} title="نتیجه پیگیری">
        <textarea className={`${fieldClass} h-28 py-2`} value={result} onChange={(e) => setResult(e.target.value)} placeholder="مشتری چه گفت؟" />
        <Button className="mt-3" onClick={() => {
          if (!doneId) return;
          const res = ws.completeTask(doneId, result);
          if (!res.ok) toast.error(res.message);
          else { toast.success("انجام شد"); setDoneId(null); }
        }}>ثبت انجام</Button>
      </Modal>
      <Modal open={open} onOpenChange={setOpen} title="وظیفه جدید">
        <div className="grid gap-3">
          <Field label="عنوان"><input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="مسئول">
            <select className={fieldClass} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              {ws.members.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="مشتری، اختیاری">
            <select className={fieldClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">بدون پرونده</option>
              {ws.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Button onClick={() => {
            const res = ws.addTask({ title, assigneeId, customerId: customerId || undefined, dueAt: atTehran(1, 11), priority: "normal" });
            if (!res.ok) toast.error(res.message);
            else { toast.success("برای فردا ثبت شد"); setOpen(false); setTitle(""); }
          }}>ثبت</Button>
        </div>
      </Modal>
    </div>
  );
}

function TaskRow({ task, onDone }: { task: Task; onDone: () => void }) {
  const ws = useWorkspace();
  const late = isOverdue(task);
  const customer = ws.allCustomers.find((c) => c.id === task.customerId);
  return (
    <article className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{task.title}</h2>
          <p className="text-sm text-muted">{customer?.name ?? "بدون مشتری"} · {memberName(ws.members, task.assigneeId)} · {task.source === "automation" ? "اتوماسیون" : task.source === "system" ? "سیستم" : "دستی"}</p>
          {task.notes ? <p className="mt-1 text-sm">{task.notes}</p> : null}
          {task.result ? <p className="mt-1 text-sm text-good">{task.result}</p> : null}
        </div>
        <Badge tone={late ? "bad" : task.status === "COMPLETED" ? "good" : "neutral"}>{late ? "عقب‌افتاده" : task.status === "COMPLETED" ? "انجام‌شده" : task.status === "CANCELLED" ? "لغو" : "باز"}</Badge>
      </div>
      <p className="mt-2 text-xs text-faint">سررسید {formatDate(task.dueAt)}</p>
      {task.status === "OPEN" || task.status === "IN_PROGRESS" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {ws.can("tasks.complete") ? <Button onClick={onDone}>انجام شد</Button> : null}
          {task.status === "OPEN" && ws.can("tasks.complete") ? <Button variant="quiet" onClick={() => ws.startTask(task.id)}>شروع</Button> : null}
          {ws.can("tasks.complete") ? <Button variant="ghost" onClick={() => { ws.snoozeTask(task.id, 2); toast.success("دو روز جابه‌جا شد"); }}>۲ روز بعد</Button> : null}
        </div>
      ) : null}
    </article>
  );
}
