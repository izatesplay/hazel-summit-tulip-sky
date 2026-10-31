import { create } from "zustand";
import { persist } from "zustand/middleware";
import { allowed } from "./access";
import { atTehran, normalizeEmail, normalizePhone, persianYear } from "./format";
import { quoteTotals } from "./money";
import { PLAN, effectiveQuoteStatus, isOpenStage, quotesThisMonth } from "./metrics";
import { createSeed } from "./seed";
import type {
  Activity,
  AutomationRun,
  Customer,
  CustomerStatus,
  Data,
  Invitation,
  Member,
  Opportunity,
  Org,
  Quote,
  QuoteItem,
  Role,
  Service,
  StageId,
  Task,
} from "./types";
import { OPEN_STAGES } from "./types";

type Dup = { id: string; name: string };
type Fail = { ok: false; message: string; duplicates?: Dup[] };
type Ok<T extends object = object> = { ok: true } & T;

type Actions = {
  setMe: (id: string) => void;
  reset: () => void;
  updateOrg: (patch: Partial<Org>) => Ok | Fail;
  addCustomer: (input: Omit<Customer, "id" | "createdAt" | "lastActivityAt">, force?: boolean) => Ok<{ id: string }> | Fail;
  updateCustomer: (id: string, patch: Partial<Customer>, force?: boolean) => Ok | Fail;
  archiveCustomer: (id: string) => Ok | Fail;
  mergeCustomers: (keepId: string, dropId: string) => Ok | Fail;
  addContact: (input: { customerId: string; name: string; roleTitle: string; phone: string; email: string }) => Ok | Fail;
  addNote: (input: { customerId: string; body: string; kind?: Activity["kind"] }) => Ok | Fail;
  addOpportunity: (input: { customerId: string; title: string; amount: number; probability: number; assigneeId: string; closeDate?: string }) => Ok<{ id: string }> | Fail;
  moveOpportunity: (id: string, to: StageId, extra?: { lostReason?: string; competitor?: string; finalAmount?: number }) => Ok | Fail;
  addQuote: (input: { customerId: string; opportunityId?: string }) => Ok<{ id: string }> | Fail;
  updateQuote: (id: string, patch: Partial<Pick<Quote, "discountPercent" | "notes" | "terms" | "validUntil" | "items" | "opportunityId">>) => Ok | Fail;
  sendQuote: (id: string) => Ok<{ status: Quote["status"] }> | Fail;
  reviseQuote: (id: string) => Ok<{ id: string }> | Fail;
  cancelQuote: (id: string) => Ok | Fail;
  markViewed: (token: string) => void;
  respondQuote: (token: string, decision: "accept" | "reject" | "comment", note: string) => Ok<{ status: string }> | Fail;
  addTask: (input: { title: string; notes?: string; customerId?: string; opportunityId?: string; quoteId?: string; assigneeId: string; dueAt: string; priority: Task["priority"] }) => Ok | Fail;
  completeTask: (id: string, result: string) => Ok | Fail;
  snoozeTask: (id: string, days: number) => Ok | Fail;
  startTask: (id: string) => Ok | Fail;
  addService: (input: Omit<Service, "id" | "active">) => Ok | Fail;
  updateService: (id: string, patch: Partial<Service>) => Ok | Fail;
  invite: (input: { name: string; email: string; role: Role }) => Ok | Fail;
  cancelInvite: (id: string) => void;
  transferWork: (fromId: string, toId: string) => Ok | Fail;
  setMemberActive: (id: string, active: boolean) => Ok | Fail;
  toggleAutomation: (id: string) => void;
  runStaleRule: () => Ok<{ created: number }> | Fail;
  markNoticesRead: () => void;
  logExport: (what: string) => void;
  recordAiUse: () => boolean;
};

export type RoshdyarStore = Data & Actions;

function uid() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function meOf(data: Data): Member {
  return data.members.find((m) => m.id === data.meId) ?? data.members[0];
}

function duplicates(data: Data, phone: string, email: string, exceptId?: string): Dup[] {
  const p = normalizePhone(phone);
  const e = normalizeEmail(email);
  const hits = new Map<string, string>();
  if (!p && !e) return [];
  for (const customer of data.customers) {
    if (customer.id === exceptId || customer.status === "ARCHIVED") continue;
    const samePhone = p && normalizePhone(customer.phone) === p;
    const sameEmail = e && normalizeEmail(customer.email) === e;
    if (samePhone || sameEmail) hits.set(customer.id, customer.name);
  }
  for (const contact of data.contacts) {
    if (contact.customerId === exceptId) continue;
    const owner = data.customers.find((c) => c.id === contact.customerId);
    if (!owner || owner.status === "ARCHIVED") continue;
    const samePhone = p && normalizePhone(contact.phone) === p;
    const sameEmail = e && contact.email && normalizeEmail(contact.email) === e;
    if (samePhone || sameEmail) hits.set(owner.id, owner.name);
  }
  return [...hits].map(([id, name]) => ({ id, name }));
}

function activity(partial: Omit<Activity, "id" | "at"> & { at?: string }): Activity {
  return { id: uid(), at: partial.at ?? nowIso(), kind: partial.kind, customerId: partial.customerId, opportunityId: partial.opportunityId, quoteId: partial.quoteId, authorId: partial.authorId, title: partial.title, body: partial.body };
}

function touch(customers: Customer[], id: string | undefined, at: string) {
  if (!id) return customers;
  return customers.map((c) => (c.id === id ? { ...c, lastActivityAt: at } : c));
}

const FLOW: StageId[] = ["new", "contacted", "discovery", "ready", "sent", "negotiation"];

export const useRoshdyar = create<RoshdyarStore>()(
  persist(
    (set, get) => ({
      ...createSeed(),

      setMe: (id) => {
        if (get().members.some((m) => m.id === id && m.active)) set({ meId: id });
      },

      reset: () => set(createSeed()),

      updateOrg: (patch) => {
        const me = meOf(get());
        if (!allowed(me.role, "settings.manage")) return { ok: false, message: "فقط مالک سازمان تنظیمات را تغییر می‌دهد." };
        if (patch.taxPercent !== undefined && (patch.taxPercent < 0 || patch.taxPercent > 50)) {
          return { ok: false, message: "درصد مالیات باید بین ۰ و ۵۰ باشد." };
        }
        set((s) => ({ org: { ...s.org, ...patch, timezone: "Asia/Tehran" } }));
        return { ok: true };
      },

      addCustomer: (input, force) => {
        const data = get();
        const me = meOf(data);
        if (!allowed(me.role, "customers.create")) return { ok: false, message: "مجوز ساخت مشتری را ندارید." };
        const activeCount = data.customers.filter((c) => c.status !== "ARCHIVED").length;
        if (activeCount >= PLAN.customers) return { ok: false, message: "سقف مشتری پلن رشد پر شده است." };
        if (!input.name.trim()) return { ok: false, message: "نام مشتری لازم است." };
        const dups = duplicates(data, input.phone, input.email);
        if (dups.length && !force) {
          return { ok: false, message: "مشتری مشابه پیدا شد. پرونده موجود را باز کنید یا آگاهانه ثبت کنید.", duplicates: dups };
        }
        const id = uid();
        const at = nowIso();
        const customer: Customer = { ...input, id, name: input.name.trim(), phone: normalizePhone(input.phone), email: normalizeEmail(input.email), createdAt: at, lastActivityAt: at };
        set((s) => ({
          customers: [customer, ...s.customers],
          activities: [activity({ kind: "system", customerId: id, authorId: me.id, title: "پرونده مشتری ساخته شد" }), ...s.activities],
        }));
        return { ok: true, id };
      },

      updateCustomer: (id, patch, force) => {
        const data = get();
        const me = meOf(data);
        if (!allowed(me.role, "customers.update")) return { ok: false, message: "مجوز ویرایش مشتری را ندارید." };
        const current = data.customers.find((c) => c.id === id);
        if (!current) return { ok: false, message: "مشتری پیدا نشد." };
        if (me.role === "sales" && current.ownerId !== me.id) return { ok: false, message: "این پرونده به شما تخصیص ندارد." };
        const phone = patch.phone !== undefined ? patch.phone : current.phone;
        const email = patch.email !== undefined ? patch.email : current.email;
        const dups = duplicates(data, phone, email, id);
        if (dups.length && !force && (patch.phone !== undefined || patch.email !== undefined)) {
          return { ok: false, message: "شماره یا ایمیل با پرونده دیگری یکی است.", duplicates: dups };
        }
        set((s) => ({
          customers: s.customers.map((c) =>
            c.id === id
              ? { ...c, ...patch, phone: normalizePhone(phone), email: normalizeEmail(email), name: (patch.name ?? c.name).trim() }
              : c,
          ),
        }));
        return { ok: true };
      },

      archiveCustomer: (id) => {
        const data = get();
        const me = meOf(data);
        if (!allowed(me.role, "customers.update")) return { ok: false, message: "مجوز بایگانی را ندارید." };
        set((s) => ({
          customers: s.customers.map((c) => (c.id === id ? { ...c, status: "ARCHIVED" as CustomerStatus } : c)),
          activities: [activity({ kind: "system", customerId: id, authorId: me.id, title: "پرونده بایگانی شد" }), ...s.activities],
        }));
        return { ok: true };
      },

      mergeCustomers: (keepId, dropId) => {
        const data = get();
        const me = meOf(data);
        if (!allowed(me.role, "customers.update")) return { ok: false, message: "مجوز ادغام را ندارید." };
        if (keepId === dropId) return { ok: false, message: "دو پرونده متفاوت انتخاب کنید." };
        const keep = data.customers.find((c) => c.id === keepId);
        const drop = data.customers.find((c) => c.id === dropId);
        if (!keep || !drop) return { ok: false, message: "هر دو پرونده باید موجود باشند." };
        const at = nowIso();
        set((s) => ({
          customers: s.customers.map((c) => {
            if (c.id === dropId) return { ...c, status: "ARCHIVED" as CustomerStatus, notes: `${c.notes}\nادغام شد در «${keep.name}».`.trim(), lastActivityAt: at };
            if (c.id === keepId) return { ...c, lastActivityAt: at };
            return c;
          }),
          contacts: s.contacts.map((c) => (c.customerId === dropId ? { ...c, customerId: keepId } : c)),
          opportunities: s.opportunities.map((o) => (o.customerId === dropId ? { ...o, customerId: keepId } : o)),
          quotes: s.quotes.map((q) => (q.customerId === dropId ? { ...q, customerId: keepId } : q)),
          tasks: s.tasks.map((t) => (t.customerId === dropId ? { ...t, customerId: keepId } : t)),
          activities: [
            activity({ kind: "system", customerId: keepId, authorId: me.id, title: "پرونده تکراری ادغام شد", body: `«${drop.name}» با حفظ فعالیت‌ها، پیشنهادها و وظایف در این پرونده ادغام و سپس بایگانی شد.`, at }),
            ...s.activities.map((a) => (a.customerId === dropId ? { ...a, customerId: keepId } : a)),
          ],
        }));
        return { ok: true };
      },

      addContact: (input) => {
        const me = meOf(get());
        if (!allowed(me.role, "customers.update")) return { ok: false, message: "مجوز افزودن مخاطب را ندارید." };
        if (!input.name.trim()) return { ok: false, message: "نام مخاطب لازم است." };
        set((s) => ({
          contacts: [{ id: uid(), ...input, name: input.name.trim(), phone: normalizePhone(input.phone), email: normalizeEmail(input.email) }, ...s.contacts],
        }));
        return { ok: true };
      },

      addNote: (input) => {
        const me = meOf(get());
        if (!input.body.trim()) return { ok: false, message: "متن یادداشت خالی است." };
        if (me.role === "viewer" || me.role === "finance") return { ok: false, message: "این نقش اجازه ثبت یادداشت ندارد." };
        const at = nowIso();
        set((s) => ({
          activities: [activity({ kind: input.kind ?? "note", customerId: input.customerId, authorId: me.id, title: input.kind === "call" ? "تماس" : input.kind === "meeting" ? "جلسه" : "یادداشت", body: input.body.trim(), at }), ...s.activities],
          customers: touch(s.customers, input.customerId, at),
        }));
        return { ok: true };
      },

      addOpportunity: (input) => {
        const data = get();
        const me = meOf(data);
        if (!allowed(me.role, "opportunities.create")) return { ok: false, message: "مجوز ساخت فرصت را ندارید." };
        const customer = data.customers.find((c) => c.id === input.customerId);
        if (!customer || customer.status === "ARCHIVED") return { ok: false, message: "مشتری معتبر نیست." };
        if (!input.title.trim()) return { ok: false, message: "عنوان فرصت لازم است." };
        const amount = Math.round(input.amount);
        if (amount <= 0) return { ok: false, message: "مبلغ احتمالی باید بزرگ‌تر از صفر باشد." };
        const probability = Math.min(100, Math.max(0, Math.round(input.probability)));
        const id = uid();
        const at = nowIso();
        const opp: Opportunity = {
          id, customerId: input.customerId, title: input.title.trim(), stage: "new", amount, probability,
          assigneeId: input.assigneeId, closeDate: input.closeDate, stageEnteredAt: at, createdAt: at,
        };
        set((s) => ({
          opportunities: [opp, ...s.opportunities],
          stageMoves: [{ id: uid(), opportunityId: id, from: null, to: "new", at, byId: me.id }, ...s.stageMoves],
          activities: [activity({ kind: "system", customerId: input.customerId, opportunityId: id, authorId: me.id, title: "فرصت فروش ساخته شد", body: opp.title, at }), ...s.activities],
          customers: touch(s.customers, input.customerId, at),
        }));
        return { ok: true, id };
      },

      moveOpportunity: (id, to, extra) => {
        const data = get();
        const me = meOf(data);
        if (!allowed(me.role, "opportunities.move")) return { ok: false, message: "مجوز انتقال مرحله را ندارید." };
        const opp = data.opportunities.find((o) => o.id === id);
        if (!opp) return { ok: false, message: "فرصت پیدا نشد." };
        if (me.role === "sales" && opp.assigneeId !== me.id) return { ok: false, message: "این فرصت به شما تخصیص ندارد." };
        if (!OPEN_STAGES.includes(to) && to !== "won" && to !== "lost") return { ok: false, message: "مرحله مقصد معتبر نیست." };
        if (opp.stage === to) return { ok: true };
        if (to === "lost" && !extra?.lostReason?.trim()) return { ok: false, message: "برای فروش ناموفق، دلیل باخت لازم است." };
        const finalAmount = Math.round(extra?.finalAmount ?? 0);
        if (to === "won" && finalAmount <= 0) return { ok: false, message: "برای فروش موفق، مبلغ نهایی لازم است." };
        const at = nowIso();
        const lost = to === "lost";
        const won = to === "won";
        set((s) => {
          const customer = s.customers.find((c) => c.id === opp.customerId);
          const promote = won && customer && ["NEW", "CONTACTED", "QUALIFIED"].includes(customer.status);
          return {
            opportunities: s.opportunities.map((o) =>
              o.id === id
                ? {
                    ...o,
                    stage: to,
                    stageEnteredAt: at,
                    probability: won ? 100 : lost ? 0 : o.probability,
                    finalAmount: won ? finalAmount : o.finalAmount,
                    wonAt: won ? at : o.wonAt,
                    lostReason: lost ? extra?.lostReason?.trim() : o.lostReason,
                    competitor: extra?.competitor?.trim() || o.competitor,
                  }
                : o,
            ),
            stageMoves: [{ id: uid(), opportunityId: id, from: opp.stage, to, at, byId: me.id, note: lost ? extra?.lostReason : won ? `مبلغ نهایی ${finalAmount}` : undefined }, ...s.stageMoves],
            customers: s.customers.map((c) => (promote && c.id === opp.customerId ? { ...c, status: "ACTIVE" as CustomerStatus, lastActivityAt: at } : c.id === opp.customerId ? { ...c, lastActivityAt: at } : c)),
            tasks: won || lost
              ? s.tasks.map((t) =>
                  t.opportunityId === id && (t.status === "OPEN" || t.status === "IN_PROGRESS")
                    ? { ...t, status: "CANCELLED" as const, result: won ? "با ثبت فروش موفق بسته شد" : "با ثبت باخت بسته شد" }
                    : t,
                )
              : s.tasks,
            activities: [
              activity({
                kind: "system",
                customerId: opp.customerId,
                opportunityId: id,
                authorId: me.id,
                title: won ? "فروش موفق ثبت شد" : lost ? "فروش ناموفق ثبت شد" : "مرحله فرصت تغییر کرد",
                body: won
                  ? `مبلغ نهایی ثبت شد.${promote ? " وضعیت مشتری به فعال تغییر کرد." : ""} پذیرش پیشنهاد یا این انتقال به معنی وصول وجه نیست.`
                  : lost
                    ? `دلیل: ${extra?.lostReason}${extra?.competitor ? ` · رقیب: ${extra.competitor}` : ""}`
                    : undefined,
                at,
              }),
              ...s.activities,
            ],
          };
        });
        return { ok: true };
      },

      addQuote: (input) => {
        const data = get();
        const me = meOf(data);
        if (!allowed(me.role, "quotes.create")) return { ok: false, message: "مجوز صدور پیشنهاد را ندارید." };
        if (quotesThisMonth(data.quotes) >= PLAN.quotesPerMonth) return { ok: false, message: "سقف پیشنهاد این ماه در پلن رشد پر شده است." };
        const customer = data.customers.find((c) => c.id === input.customerId);
        if (!customer || customer.status === "ARCHIVED") return { ok: false, message: "مشتری معتبر نیست." };
        const id = uid();
        const at = nowIso();
        const seq = data.quoteSeq + 1;
        const quote: Quote = {
          id,
          number: `${data.org.quotePrefix}-${persianYear()}-${String(seq).padStart(4, "0")}`,
          customerId: input.customerId,
          opportunityId: input.opportunityId,
          status: "DRAFT",
          items: [],
          discountPercent: 0,
          taxPercent: data.org.taxPercent,
          terms: data.quotes[0]?.terms || "",
          notes: "",
          validUntil: atTehran(14, 18),
          createdAt: at,
          token: uid().replace(/-/g, ""),
          ownerId: me.id,
          version: 1,
        };
        set((s) => ({
          quoteSeq: seq,
          quotes: [quote, ...s.quotes],
          quoteEvents: [{ id: uid(), quoteId: id, type: "created", at }, ...s.quoteEvents],
          activities: [activity({ kind: "system", customerId: input.customerId, quoteId: id, authorId: me.id, title: "پیش‌نویس پیشنهاد ساخته شد", body: quote.number, at }), ...s.activities],
        }));
        return { ok: true, id };
      },

      updateQuote: (id, patch) => {
        const data = get();
        const me = meOf(data);
        if (!allowed(me.role, "quotes.create")) return { ok: false, message: "مجوز ویرایش پیشنهاد را ندارید." };
        const quote = data.quotes.find((q) => q.id === id);
        if (!quote) return { ok: false, message: "پیشنهاد پیدا نشد." };
        if (quote.status !== "DRAFT" && quote.status !== "PENDING_APPROVAL") {
          return { ok: false, message: "پیشنهاد ارسال‌شده را بی‌ردپا عوض نکنید. نسخه جدید بسازید." };
        }
        const discountPercent = patch.discountPercent !== undefined ? Math.min(100, Math.max(0, Math.round(patch.discountPercent))) : quote.discountPercent;
        set((s) => ({
          quotes: s.quotes.map((q) =>
            q.id === id
              ? { ...q, ...patch, discountPercent, status: "DRAFT", items: patch.items ? patch.items.map(normalizeItem) : q.items }
              : q,
          ),
        }));
        return { ok: true };
      },

      sendQuote: (id) => {
        const data = get();
        const me = meOf(data);
        if (!allowed(me.role, "quotes.send")) return { ok: false, message: "مجوز ارسال پیشنهاد را ندارید." };
        const quote = data.quotes.find((q) => q.id === id);
        if (!quote) return { ok: false, message: "پیشنهاد پیدا نشد." };
        if (quote.status !== "DRAFT" && quote.status !== "PENDING_APPROVAL") {
          return { ok: false, message: "فقط پیش‌نویس یا مورد منتظر تأیید قابل ارسال است." };
        }
        if (quote.items.length === 0) return { ok: false, message: "حداقل یک ردیف لازم است. مبلغ نهایی از ردیف‌ها حساب می‌شود." };
        const cap = data.org.discountCaps[me.role] ?? 0;
        if (quote.discountPercent > cap) {
          const at = nowIso();
          set((s) => ({
            quotes: s.quotes.map((q) => (q.id === id ? { ...q, status: "PENDING_APPROVAL" } : q)),
            quoteEvents: [{ id: uid(), quoteId: id, type: "approval", at, note: `تخفیف ${quote.discountPercent}٪ بالاتر از سقف ${cap}٪` }, ...s.quoteEvents],
            notices: [{ id: uid(), at, title: "تخفیف منتظر تأیید است", body: quote.number, href: `/quotes/${id}`, read: false }, ...s.notices],
            activities: [activity({ kind: "system", customerId: quote.customerId, quoteId: id, authorId: me.id, title: "پیشنهاد برای تأیید تخفیف رفت", body: `سقف نقش شما ${cap} درصد است.`, at }), ...s.activities],
          }));
          return { ok: true, status: "PENDING_APPROVAL" };
        }
        const at = nowIso();
        const auto = data.automations.find((a) => a.trigger === "quote.sent" && a.enabled);
        const followKey = `quote.followup:${id}`;
        const already = data.tasks.some((t) => t.idempotencyKey === followKey);
        const opp = data.opportunities.find((o) => o.id === quote.opportunityId);
        const assignee = opp?.assigneeId ?? quote.ownerId;
        const shouldFollow = Boolean(auto) && !already && effectiveQuoteStatus(quote) !== "ACCEPTED";
        const due = atTehran(data.org.followUpDays, 11);
        set((s) => {
          const parentId = quote.parentQuoteId;
          return {
            quotes: s.quotes.map((q) => {
              if (q.id === id) return { ...q, status: "SENT" as const, sentAt: at };
              if (parentId && q.id === parentId && (q.status === "SENT" || q.status === "VIEWED")) return { ...q, status: "SUPERSEDED" as const };
              return q;
            }),
            quoteEvents: [{ id: uid(), quoteId: id, type: "sent", at, note: quote.status === "PENDING_APPROVAL" ? "پس از تأیید تخفیف ارسال شد" : undefined }, ...s.quoteEvents],
            opportunities: s.opportunities.map((o) => {
              if (o.id !== quote.opportunityId) return o;
              const index = FLOW.indexOf(o.stage);
              if (index === -1 || index >= FLOW.indexOf("sent")) return o;
              return { ...o, stage: "sent" as const, stageEnteredAt: at };
            }),
            stageMoves:
              opp && FLOW.includes(opp.stage) && FLOW.indexOf(opp.stage) < FLOW.indexOf("sent")
                ? [{ id: uid(), opportunityId: opp.id, from: opp.stage, to: "sent" as const, at, byId: me.id, note: "با ارسال پیشنهاد" }, ...s.stageMoves]
                : s.stageMoves,
            tasks: shouldFollow
              ? [{
                  id: uid(), title: "پیگیری پیشنهاد", notes: "اگر پذیرفته یا رد نشده، تماس بگیرید.",
                  customerId: quote.customerId, opportunityId: quote.opportunityId, quoteId: id,
                  creatorId: me.id, assigneeId: assignee, dueAt: due, priority: "high" as const,
                  status: "OPEN" as const, source: "automation" as const, idempotencyKey: followKey, createdAt: at,
                }, ...s.tasks]
              : s.tasks,
            automationRuns: shouldFollow
              ? [{ id: uid(), automationId: auto!.id, at, ok: true, summary: `وظیفه پیگیری ${quote.number} ساخته شد`, idempotencyKey: followKey }, ...s.automationRuns]
              : s.automationRuns,
            activities: [activity({ kind: "system", customerId: quote.customerId, opportunityId: quote.opportunityId, quoteId: id, authorId: me.id, title: "پیشنهاد ارسال شد", body: shouldFollow ? `وظیفه پیگیری برای ${data.org.followUpDays} روز بعد ثبت شد.` : quote.number, at }), ...s.activities],
            customers: touch(s.customers, quote.customerId, at),
            notices: [{ id: uid(), at, title: "پیشنهاد ارسال شد", body: quote.number, href: `/quotes/${id}`, read: false }, ...s.notices],
          };
        });
        return { ok: true, status: "SENT" };
      },

      reviseQuote: (id) => {
        const data = get();
        const me = meOf(data);
        if (!allowed(me.role, "quotes.create")) return { ok: false, message: "مجوز نسخه جدید را ندارید." };
        const quote = data.quotes.find((q) => q.id === id);
        if (!quote) return { ok: false, message: "پیشنهاد پیدا نشد." };
        const status = effectiveQuoteStatus(quote);
        if (!["SENT", "VIEWED", "REJECTED", "EXPIRED"].includes(status)) {
          return { ok: false, message: "برای این وضعیت نسخه جدید لازم نیست." };
        }
        if (quotesThisMonth(data.quotes) >= PLAN.quotesPerMonth) return { ok: false, message: "سقف پیشنهاد این ماه پر شده است." };
        const newId = uid();
        const at = nowIso();
        const seq = data.quoteSeq + 1;
        const next: Quote = {
          ...quote,
          id: newId,
          number: `${data.org.quotePrefix}-${persianYear()}-${String(seq).padStart(4, "0")}`,
          status: "DRAFT",
          items: quote.items.map((item) => ({ ...item, id: uid() })),
          createdAt: at,
          sentAt: undefined,
          viewedAt: undefined,
          respondedAt: undefined,
          responseNote: undefined,
          token: uid().replace(/-/g, ""),
          ownerId: me.id,
          parentQuoteId: quote.id,
          version: quote.version + 1,
          taxPercent: quote.taxPercent,
        };
        set((s) => ({
          quoteSeq: seq,
          quotes: [next, ...s.quotes],
          quoteEvents: [
            { id: uid(), quoteId: newId, type: "revision", at, note: `نسخه ${next.version} از ${quote.number}` },
            { id: uid(), quoteId: id, type: "revision", at, note: `نسخه جدید ${next.number} ساخته شد؛ نسخه قبلی تا ارسال نسخه جدید سر جایش می‌ماند` },
            ...s.quoteEvents,
          ],
        }));
        return { ok: true, id: newId };
      },

      cancelQuote: (id) => {
        const data = get();
        const me = meOf(data);
        if (!allowed(me.role, "quotes.send")) return { ok: false, message: "مجوز لغو پیشنهاد را ندارید." };
        const quote = data.quotes.find((q) => q.id === id);
        if (!quote) return { ok: false, message: "پیشنهاد پیدا نشد." };
        const status = effectiveQuoteStatus(quote);
        if (["ACCEPTED", "CANCELLED", "SUPERSEDED"].includes(status)) return { ok: false, message: "این پیشنهاد دیگر قابل لغو نیست." };
        const at = nowIso();
        set((s) => ({
          quotes: s.quotes.map((q) => (q.id === id ? { ...q, status: "CANCELLED" } : q)),
          quoteEvents: [{ id: uid(), quoteId: id, type: "cancelled", at }, ...s.quoteEvents],
          tasks: s.tasks.map((t) => (t.quoteId === id && (t.status === "OPEN" || t.status === "IN_PROGRESS") ? { ...t, status: "CANCELLED" as const, result: "پیشنهاد لغو شد" } : t)),
          activities: [activity({ kind: "system", customerId: quote.customerId, quoteId: id, authorId: me.id, title: "پیشنهاد لغو شد", at }), ...s.activities],
        }));
        return { ok: true };
      },

      markViewed: (token) => {
        const quote = get().quotes.find((q) => q.token === token);
        if (!quote || quote.status !== "SENT") return;
        if (effectiveQuoteStatus(quote) === "EXPIRED") return;
        const at = nowIso();
        set((s) => ({
          quotes: s.quotes.map((q) => (q.id === quote.id ? { ...q, status: "VIEWED", viewedAt: at } : q)),
          quoteEvents: s.quoteEvents.some((e) => e.quoteId === quote.id && e.type === "viewed")
            ? s.quoteEvents
            : [{ id: uid(), quoteId: quote.id, type: "viewed", at }, ...s.quoteEvents],
          activities: [activity({ kind: "system", customerId: quote.customerId, quoteId: quote.id, authorId: quote.ownerId, title: "مشتری پیشنهاد را دید", at }), ...s.activities],
          notices: [{ id: uid(), at, title: "پیشنهاد دیده شد", body: quote.number, href: `/quotes/${quote.id}`, read: false }, ...s.notices],
          customers: touch(s.customers, quote.customerId, at),
        }));
      },

      respondQuote: (token, decision, note) => {
        const data = get();
        const quote = data.quotes.find((q) => q.token === token);
        if (!quote) return { ok: false, message: "این پیوند معتبر نیست." };
        const status = effectiveQuoteStatus(quote);
        if (status === "EXPIRED") return { ok: false, message: "اعتبار این پیشنهاد تمام شده است." };
        if (status === "CANCELLED" || status === "SUPERSEDED") return { ok: false, message: "این پیشنهاد دیگر فعال نیست." };
        if (status === "ACCEPTED" || status === "REJECTED") return { ok: true, status };
        if (status !== "SENT" && status !== "VIEWED") return { ok: false, message: "این پیشنهاد هنوز برای پاسخ منتشر نشده است." };
        const at = nowIso();
        const text = note.trim();
        if (decision === "comment") {
          if (!text) return { ok: false, message: "توضیح یا درخواست اصلاح را بنویسید." };
          const key = `comment:${quote.id}:${text.slice(0, 80)}`;
          if (data.tasks.some((t) => t.idempotencyKey === key)) return { ok: true, status: "VIEWED" };
          set((s) => ({
            quotes: s.quotes.map((q) => (q.id === quote.id ? { ...q, status: q.status === "SENT" ? "VIEWED" : q.status, viewedAt: q.viewedAt ?? at } : q)),
            quoteEvents: [{ id: uid(), quoteId: quote.id, type: "comment", at, note: text }, ...s.quoteEvents],
            tasks: [{
              id: uid(), title: "درخواست اصلاح پیشنهاد", notes: text, customerId: quote.customerId,
              opportunityId: quote.opportunityId, quoteId: quote.id, creatorId: quote.ownerId, assigneeId: quote.ownerId,
              dueAt: atTehran(1, 11), priority: "high" as const, status: "OPEN" as const, source: "system" as const,
              idempotencyKey: key, createdAt: at,
            }, ...s.tasks],
            activities: [activity({ kind: "note", customerId: quote.customerId, quoteId: quote.id, authorId: quote.ownerId, title: "مشتری توضیح یا اصلاح خواست", body: text, at }), ...s.activities],
            notices: [{ id: uid(), at, title: "درخواست اصلاح پیشنهاد", body: quote.number, href: `/quotes/${quote.id}`, read: false }, ...s.notices],
          }));
          return { ok: true, status: "VIEWED" };
        }
        const next = decision === "accept" ? "ACCEPTED" : "REJECTED";
        set((s) => ({
          quotes: s.quotes.map((q) => (q.id === quote.id ? { ...q, status: next, respondedAt: at, responseNote: text, viewedAt: q.viewedAt ?? at } : q)),
          quoteEvents: [{ id: uid(), quoteId: quote.id, type: decision === "accept" ? "accepted" : "rejected", at, note: text }, ...s.quoteEvents],
          tasks: [
            ...(decision === "accept"
              ? [{
                  id: uid(), title: "ثبت نتیجه پس از پذیرش پیشنهاد",
                  notes: "پذیرش به معنی وصول وجه نیست. مبلغ نهایی را در فرصت فروش ثبت کنید.",
                  customerId: quote.customerId, opportunityId: quote.opportunityId, quoteId: quote.id,
                  creatorId: quote.ownerId, assigneeId: s.opportunities.find((o) => o.id === quote.opportunityId)?.assigneeId ?? quote.ownerId,
                  dueAt: atTehran(0, 17), priority: "high" as const, status: "OPEN" as const, source: "system" as const,
                  idempotencyKey: `accept:${quote.id}`, createdAt: at,
                }]
              : []),
            ...s.tasks.map((t) =>
              decision === "reject" && t.quoteId === quote.id && t.idempotencyKey?.startsWith("quote.followup") && (t.status === "OPEN" || t.status === "IN_PROGRESS")
                ? { ...t, status: "CANCELLED" as const, result: "مشتری پیشنهاد را رد کرد" }
                : t,
            ),
          ],
          activities: [activity({
            kind: "system", customerId: quote.customerId, quoteId: quote.id, opportunityId: quote.opportunityId, authorId: quote.ownerId,
            title: decision === "accept" ? "مشتری پیشنهاد را پذیرفت" : "مشتری پیشنهاد را رد کرد",
            body: text || (decision === "accept" ? "پذیرش ثبت شد. این رویداد با دریافت وجه یکی نیست." : "بدون توضیح"),
            at,
          }), ...s.activities],
          notices: [{ id: uid(), at, title: decision === "accept" ? "پیشنهاد پذیرفته شد" : "پیشنهاد رد شد", body: quote.number, href: `/quotes/${quote.id}`, read: false }, ...s.notices],
          customers: touch(s.customers, quote.customerId, at),
        }));
        return { ok: true, status: next };
      },

      addTask: (input) => {
        const me = meOf(get());
        if (!allowed(me.role, "tasks.create")) return { ok: false, message: "مجوز ساخت وظیفه را ندارید." };
        if (!input.title.trim()) return { ok: false, message: "عنوان وظیفه لازم است." };
        const at = nowIso();
        set((s) => ({
          tasks: [{
            id: uid(), title: input.title.trim(), notes: input.notes?.trim() ?? "", customerId: input.customerId,
            opportunityId: input.opportunityId, quoteId: input.quoteId, creatorId: me.id, assigneeId: input.assigneeId,
            dueAt: input.dueAt, priority: input.priority, status: "OPEN", source: "manual", createdAt: at,
          }, ...s.tasks],
        }));
        return { ok: true };
      },

      completeTask: (id, result) => {
        const data = get();
        const me = meOf(data);
        if (!allowed(me.role, "tasks.complete")) return { ok: false, message: "مجوز تکمیل وظیفه را ندارید." };
        const task = data.tasks.find((t) => t.id === id);
        if (!task) return { ok: false, message: "وظیفه پیدا نشد." };
        if (me.role === "sales" && task.assigneeId !== me.id) return { ok: false, message: "این وظیفه برای شما نیست." };
        if (!result.trim()) return { ok: false, message: "نتیجه انجام را بنویسید." };
        if (task.status === "COMPLETED") return { ok: true };
        const at = nowIso();
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: "COMPLETED", result: result.trim(), completedAt: at } : t)),
          activities: [activity({ kind: "call", customerId: task.customerId, opportunityId: task.opportunityId, quoteId: task.quoteId, authorId: me.id, title: `پیگیری انجام شد: ${task.title}`, body: result.trim(), at }), ...s.activities],
          customers: touch(s.customers, task.customerId, at),
        }));
        return { ok: true };
      },

      snoozeTask: (id, days) => {
        const data = get();
        const me = meOf(data);
        if (!allowed(me.role, "tasks.complete")) return { ok: false, message: "مجوز تغییر وظیفه را ندارید." };
        const task = data.tasks.find((t) => t.id === id);
        if (!task || task.status === "COMPLETED" || task.status === "CANCELLED") return { ok: false, message: "این وظیفه باز نیست." };
        const due = new Date(new Date(task.dueAt).getTime() + days * 86_400_000).toISOString();
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, dueAt: due, status: "OPEN" } : t)) }));
        return { ok: true };
      },

      startTask: (id) => {
        const me = meOf(get());
        if (!allowed(me.role, "tasks.complete")) return { ok: false, message: "مجوز تغییر وظیفه را ندارید." };
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id && t.status === "OPEN" ? { ...t, status: "IN_PROGRESS" } : t)) }));
        return { ok: true };
      },

      addService: (input) => {
        const me = meOf(get());
        if (!allowed(me.role, "settings.manage") && me.role !== "manager") return { ok: false, message: "تعریف خدمت با مالک یا مدیر فروش است." };
        if (!input.name.trim() || input.price < 0) return { ok: false, message: "نام و قیمت معتبر لازم است." };
        set((s) => ({ services: [{ ...input, id: uid(), name: input.name.trim(), price: Math.round(input.price), active: true }, ...s.services] }));
        return { ok: true };
      },

      updateService: (id, patch) => {
        const me = meOf(get());
        if (!allowed(me.role, "settings.manage") && me.role !== "manager") return { ok: false, message: "ویرایش کاتالوگ با مالک یا مدیر فروش است." };
        set((s) => ({
          services: s.services.map((svc) => (svc.id === id ? { ...svc, ...patch, price: patch.price !== undefined ? Math.round(patch.price) : svc.price } : svc)),
        }));
        return { ok: true };
      },

      invite: (input) => {
        const data = get();
        const me = meOf(data);
        if (!allowed(me.role, "members.invite")) return { ok: false, message: "مجوز دعوت عضو را ندارید." };
        if (!input.name.trim() || !input.email.includes("@")) return { ok: false, message: "نام و ایمیل معتبر لازم است." };
        const seats = data.members.filter((m) => m.active).length + data.invitations.filter((i) => i.status === "pending").length;
        if (seats >= PLAN.members) return { ok: false, message: "سقف عضو پلن رشد پر شده است." };
        const invite: Invitation = { id: uid(), name: input.name.trim(), email: normalizeEmail(input.email), role: input.role, status: "pending", createdAt: nowIso() };
        set((s) => ({ invitations: [invite, ...s.invitations] }));
        return { ok: true };
      },

      cancelInvite: (id) => {
        const me = meOf(get());
        if (!allowed(me.role, "members.invite")) return;
        set((s) => ({ invitations: s.invitations.map((i) => (i.id === id ? { ...i, status: "cancelled" } : i)) }));
      },

      transferWork: (fromId, toId) => {
        const me = meOf(get());
        if (!allowed(me.role, "members.invite")) return { ok: false, message: "انتقال مسئولیت با مدیر یا مالک است." };
        if (fromId === toId) return { ok: false, message: "مقصد باید عضو دیگری باشد." };
        set((s) => ({
          customers: s.customers.map((c) => (c.ownerId === fromId ? { ...c, ownerId: toId } : c)),
          opportunities: s.opportunities.map((o) => (o.assigneeId === fromId && isOpenStage(o.stage) ? { ...o, assigneeId: toId } : o)),
          tasks: s.tasks.map((t) => (t.assigneeId === fromId && (t.status === "OPEN" || t.status === "IN_PROGRESS") ? { ...t, assigneeId: toId } : t)),
          activities: [activity({ kind: "system", authorId: me.id, title: "مسئولیت پرونده‌ها منتقل شد", body: "مشتریان، فرصت‌های باز و وظایف باز منتقل شدند." }), ...s.activities],
        }));
        return { ok: true };
      },

      setMemberActive: (id, active) => {
        const data = get();
        const me = meOf(data);
        if (me.role !== "owner") return { ok: false, message: "فعال یا غیرفعال کردن عضو فقط با مالک است." };
        const member = data.members.find((m) => m.id === id);
        if (!member) return { ok: false, message: "عضو پیدا نشد." };
        if (member.role === "owner") return { ok: false, message: "مالک را نمی‌توان غیرفعال کرد." };
        set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, active } : m)) }));
        return { ok: true };
      },

      toggleAutomation: (id) => {
        const me = meOf(get());
        if (me.role !== "owner" && me.role !== "manager") return;
        set((s) => ({ automations: s.automations.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)) }));
      },

      runStaleRule: () => {
        const data = get();
        const me = meOf(data);
        if (me.role === "viewer" || me.role === "finance") return { ok: false, message: "اجرای قانون برای این نقش باز نیست." };
        const rule = data.automations.find((a) => a.trigger === "opportunity.stale");
        if (!rule?.enabled) return { ok: false, message: "قانون فرصت راکد خاموش است." };
        const at = nowIso();
        let created = 0;
        const tasks: Task[] = [];
        const runs: AutomationRun[] = [];
        for (const opp of data.opportunities) {
          if (!isOpenStage(opp.stage)) continue;
          const age = Date.now() - new Date(opp.stageEnteredAt).getTime();
          if (age < data.org.staleDays * 86_400_000) continue;
          const key = `stale:${opp.id}:${opp.stageEnteredAt}`;
          if (data.tasks.some((t) => t.idempotencyKey === key) || data.automationRuns.some((r) => r.idempotencyKey === key)) continue;
          created += 1;
          tasks.push({
            id: uid(), title: "پیگیری فرصت راکد", notes: opp.title, customerId: opp.customerId, opportunityId: opp.id,
            creatorId: me.id, assigneeId: opp.assigneeId, dueAt: atTehran(0, 16), priority: "high", status: "OPEN",
            source: "automation", idempotencyKey: key, createdAt: at,
          });
          runs.push({ id: uid(), automationId: rule.id, at, ok: true, summary: `وظیفه برای «${opp.title}»`, idempotencyKey: key });
        }
        if (created === 0) {
          set((s) => ({
            automationRuns: [{ id: uid(), automationId: rule.id, at, ok: true, summary: "مورد جدیدی برای ساخت وظیفه نبود", idempotencyKey: `stale-scan:${at}` }, ...s.automationRuns],
          }));
          return { ok: true, created: 0 };
        }
        set((s) => ({ tasks: [...tasks, ...s.tasks], automationRuns: [...runs, ...s.automationRuns] }));
        return { ok: true, created };
      },

      markNoticesRead: () => set((s) => ({ notices: s.notices.map((n) => ({ ...n, read: true })) })),

      logExport: (what) => {
        const me = meOf(get());
        if (!allowed(me.role, "data.export")) return;
        set((s) => ({
          activities: [activity({ kind: "system", authorId: me.id, title: "خروجی داده گرفته شد", body: what }), ...s.activities],
        }));
      },

      recordAiUse: () => {
        if (get().aiUses >= PLAN.previewAiCap) return false;
        set((s) => ({ aiUses: s.aiUses + 1 }));
        return true;
      },
    }),
    {
      name: "roshdyar-v1",
      version: 1,
      skipHydration: true,
      partialize: (s) => ({
        org: s.org,
        members: s.members,
        meId: s.meId,
        customers: s.customers,
        contacts: s.contacts,
        opportunities: s.opportunities,
        stageMoves: s.stageMoves,
        services: s.services,
        quotes: s.quotes,
        quoteEvents: s.quoteEvents,
        tasks: s.tasks,
        activities: s.activities,
        automations: s.automations,
        automationRuns: s.automationRuns,
        notices: s.notices,
        invitations: s.invitations,
        quoteSeq: s.quoteSeq,
        aiUses: s.aiUses,
      }),
    },
  ),
);

function normalizeItem(item: QuoteItem): QuoteItem {
  return {
    ...item,
    qty: Math.max(1, Math.round(item.qty || 1)),
    unitPrice: Math.max(0, Math.round(item.unitPrice || 0)),
    title: item.title.trim() || "ردیف بدون عنوان",
  };
}
