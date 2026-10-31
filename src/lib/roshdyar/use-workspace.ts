import { allowed, canSeeCustomer, canSeeOpportunity, canSeeQuote, canSeeTask, type Permission } from "./access";
import { useRoshdyar } from "./store";
import type { Member } from "./types";

export function useWorkspace() {
  const store = useRoshdyar();
  const me = store.members.find((m) => m.id === store.meId) ?? store.members[0];
  const customers = store.customers.filter((c) => canSeeCustomer(me, c));
  const opportunities = store.opportunities.filter((o) => canSeeOpportunity(me, o, store.customers));
  const quotes = store.quotes.filter((q) => canSeeQuote(me, q, store.customers));
  const tasks = store.tasks.filter((t) => canSeeTask(me, t));
  const visibleIds = new Set(customers.map((c) => c.id));
  const activities = store.activities.filter((a) => {
    if (me.role !== "sales") return true;
    if (!a.customerId) return a.authorId === me.id;
    return visibleIds.has(a.customerId);
  });
  return {
    ...store,
    me,
    customers,
    opportunities,
    quotes,
    tasks,
    activities,
    allCustomers: store.customers,
    allQuotes: store.quotes,
    can: (permission: Permission) => allowed(me.role, permission),
  };
}

export function memberName(members: Member[], id?: string) {
  return members.find((m) => m.id === id)?.name ?? "—";
}
