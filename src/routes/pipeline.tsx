import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button, Field, Modal, PageHeader, fieldClass } from "@/components/ui";
import { daysSince, formatTomanShort } from "@/lib/roshdyar/format";
import { isStale, nominalOpen, weightedOpen } from "@/lib/roshdyar/metrics";
import { LOST_REASONS, STAGES, type StageId } from "@/lib/roshdyar/types";
import { memberName, useWorkspace } from "@/lib/roshdyar/use-workspace";

export const Route = createFileRoute("/pipeline")({ component: Page });

function Page() {
  return (
    <AppShell>
      <Board />
    </AppShell>
  );
}

function Board() {
  const ws = useWorkspace();
  const [drag, setDrag] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; stage: "won" | "lost" } | null>(null);
  const [reason, setReason] = useState<string>(LOST_REASONS[0]);
  const [competitor, setCompetitor] = useState("");
  const [finalAmount, setFinalAmount] = useState(0);
  const [creating, setCreating] = useState(false);
  const [customerId, setCustomerId] = useState(ws.customers[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(100_000_000);
  const nominal = nominalOpen(ws.opportunities);
  const weighted = weightedOpen(ws.opportunities);

  function move(id: string, stage: StageId) {
    if (stage === "won" || stage === "lost") {
      const opp = ws.opportunities.find((o) => o.id === id);
      setFinalAmount(opp?.amount ?? 0);
      setPending({ id, stage });
      return;
    }
    const res = ws.moveOpportunity(id, stage);
    if (!res.ok) toast.error(res.message);
  }

  return (
    <div>
      <PageHeader title="قیف فروش" description="مبلغ اسمی جمع فرصت‌های باز است. برآورد وزنی همان مبلغ ضرب‌در احتمال است و درآمد وصول‌شده نیست.">
        {ws.can("opportunities.create") ? <Button onClick={() => setCreating(true)}>فرصت جدید</Button> : null}
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <p>اسمی باز: <span className="font-bold text-fg">{formatTomanShort(nominal)} تومان</span></p>
        <p>وزنی: <span className="font-bold text-primary">{formatTomanShort(weighted)} تومان</span></p>
      </div>
      <div className="min-w-0 overflow-x-auto pb-3">
        <div className="flex w-max gap-3">
          {STAGES.map((stage) => {
            const cards = ws.opportunities.filter((o) => o.stage === stage.id);
            return (
              <section
                key={stage.id}
                className="w-72"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (drag) move(drag, stage.id);
                  setDrag(null);
                }}
              >
                <header className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-sm font-bold">{stage.label}</h2>
                  <span className="text-xs text-faint">{cards.length.toLocaleString("fa-IR")}</span>
                </header>
                <div className={`grid min-h-28 gap-2 rounded-card border border-dashed p-2 ${stage.kind === "won" ? "border-good/40" : stage.kind === "lost" ? "border-bad/40" : "border-line"}`}>
                  {cards.map((o) => {
                    const customer = ws.allCustomers.find((c) => c.id === o.customerId);
                    const stale = isStale(o, ws.org.staleDays);
                    return (
                      <article key={o.id} draggable={ws.can("opportunities.move")} onDragStart={() => setDrag(o.id)} className="rounded-lg border border-line bg-surface p-3">
                        <p className="font-semibold leading-6">{o.title}</p>
                        <p className="text-xs text-muted">{customer?.name}</p>
                        <p className="mt-2 text-sm tabular-nums">{formatTomanShort(o.finalAmount ?? o.amount)} <span className="text-xs text-faint">· {o.probability.toLocaleString("fa-IR")}٪</span></p>
                        <p className={`mt-1 text-xs ${stale ? "text-bad" : "text-faint"}`}>{daysSince(o.stageEnteredAt).toLocaleString("fa-IR")} روز در مرحله · {memberName(ws.members, o.assigneeId)}</p>
                        {customer ? <Link to="/customers/$customerId" params={{ customerId: customer.id }} className="mt-2 inline-block text-xs text-primary">پرونده</Link> : null}
                        {ws.can("opportunities.move") ? (
                          <select className={`${fieldClass} mt-2 h-10 text-sm`} value={o.stage} onChange={(e) => move(o.id, e.target.value as StageId)}>
                            {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                          </select>
                        ) : null}
                        {o.lostReason ? <p className="mt-2 text-xs text-bad">دلیل: {o.lostReason}</p> : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <Modal open={Boolean(pending)} onOpenChange={(v) => !v && setPending(null)} title={pending?.stage === "won" ? "ثبت فروش موفق" : "ثبت فروش ناموفق"}>
        {pending?.stage === "lost" ? (
          <div className="grid gap-3">
            <Field label="دلیل باخت">
              <select className={fieldClass} value={reason} onChange={(e) => setReason(e.target.value)}>
                {LOST_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="رقیب، اگر هست">
              <input className={fieldClass} value={competitor} onChange={(e) => setCompetitor(e.target.value)} />
            </Field>
          </div>
        ) : (
          <Field label="مبلغ نهایی تومان">
            <input className={fieldClass} dir="ltr" type="number" value={finalAmount} onChange={(e) => setFinalAmount(Number(e.target.value))} />
          </Field>
        )}
        <p className="mt-3 text-xs text-muted">وظایف باز این فرصت بسته می‌شوند. این ثبت به معنی وصول وجه نیست.</p>
        <Button className="mt-4" onClick={() => {
          if (!pending) return;
          const res = ws.moveOpportunity(pending.id, pending.stage, { lostReason: reason, competitor, finalAmount });
          if (!res.ok) toast.error(res.message);
          else { toast.success("مرحله ثبت شد"); setPending(null); }
        }}>ثبت نتیجه</Button>
      </Modal>
      <Modal open={creating} onOpenChange={setCreating} title="فرصت جدید">
        <div className="grid gap-3">
          <Field label="مشتری">
            <select className={fieldClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {ws.customers.filter((c) => c.status !== "ARCHIVED").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="عنوان">
            <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="مبلغ احتمالی">
            <input className={fieldClass} dir="ltr" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Button onClick={() => {
            const customer = ws.customers.find((c) => c.id === customerId);
            const res = ws.addOpportunity({ customerId, title, amount, probability: 20, assigneeId: customer?.ownerId ?? ws.meId });
            if (!res.ok) toast.error(res.message);
            else { toast.success("در مرحله سرنخ جدید قرار گرفت"); setCreating(false); setTitle(""); }
          }}>ساخت فرصت</Button>
        </div>
      </Modal>
    </div>
  );
}
