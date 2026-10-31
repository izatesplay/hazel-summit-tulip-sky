import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Field, PageHeader, fieldClass } from "@/components/ui";
import { ROLE_LABEL, type Role } from "@/lib/roshdyar/types";
import { useWorkspace } from "@/lib/roshdyar/use-workspace";

export const Route = createFileRoute("/team")({ component: Page });

function Page() {
  return (
    <AppShell>
      <Team />
    </AppShell>
  );
}

function Team() {
  const ws = useWorkspace();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("sales");
  const [fromId, setFromId] = useState("m_maryam");
  const [toId, setToId] = useState("m_reza");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="تیم" description="نقش، دعوت و انتقال مسئولیت پرونده‌ها. دسترسی واقعی در محصول نهایی روی سرور چک می‌شود؛ اینجا قواعد همان نقش‌ها روی داده‌های سازمان اعمال می‌شود." />
      <div className="grid gap-2">
        {ws.members.map((m) => (
          <article key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
            <div>
              <h2 className="font-semibold">{m.name}</h2>
              <p className="text-sm text-muted">{m.title} · {m.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={m.active ? "neutral" : "bad"}>{ROLE_LABEL[m.role]}</Badge>
              {ws.me.role === "owner" && m.role !== "owner" ? (
                <Button variant="ghost" onClick={() => {
                  const res = ws.setMemberActive(m.id, !m.active);
                  if (!res.ok) toast.error(res.message);
                }}>{m.active ? "غیرفعال" : "فعال"}</Button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <section className="mt-6 rounded-card border border-line bg-surface p-4">
        <h2 className="font-bold">دعوت</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Field label="نام"><input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="ایمیل"><input className={fieldClass} dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="نقش">
            <select className={fieldClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {(["sales", "manager", "finance", "viewer"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </Field>
        </div>
        <Button className="mt-3" onClick={() => {
          const res = ws.invite({ name, email, role });
          if (!res.ok) toast.error(res.message);
          else { toast.success("دعوت در حالت انتظار ماند"); setName(""); setEmail(""); }
        }}>فرستادن دعوت</Button>
        <ul className="mt-4 space-y-2 text-sm">
          {ws.invitations.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2">
              <span>{i.name} · {i.email} · {ROLE_LABEL[i.role]} · {i.status === "pending" ? "در انتظار" : "لغو"}</span>
              {i.status === "pending" && ws.can("members.invite") ? <button className="text-bad" onClick={() => ws.cancelInvite(i.id)}>لغو</button> : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-4 rounded-card border border-line bg-surface p-4">
        <h2 className="font-bold">انتقال مسئولیت</h2>
        <p className="mt-1 text-sm text-muted">مشتریان، فرصت‌های باز و وظایف باز از یک عضو به عضو دیگر می‌روند. فرصت‌های بسته‌شده جابه‌جا نمی‌شوند.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="از">
            <select className={fieldClass} value={fromId} onChange={(e) => setFromId(e.target.value)}>
              {ws.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="به">
            <select className={fieldClass} value={toId} onChange={(e) => setToId(e.target.value)}>
              {ws.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
        </div>
        <Button className="mt-3" variant="quiet" onClick={() => {
          const res = ws.transferWork(fromId, toId);
          if (!res.ok) toast.error(res.message);
          else toast.success("مسئولیت‌های باز منتقل شد");
        }}>انتقال</Button>
      </section>
    </div>
  );
}
