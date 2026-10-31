import type { Customer, Member, Opportunity, Quote, Role, Task } from "./types";

export type Permission =
  | "customers.create"
  | "customers.update"
  | "opportunities.create"
  | "opportunities.move"
  | "quotes.create"
  | "quotes.send"
  | "quotes.discount.approve"
  | "tasks.create"
  | "tasks.complete"
  | "members.invite"
  | "settings.manage"
  | "billing.manage"
  | "data.export";

const GRANTS: Record<Role, Permission[] | "*"> = {
  owner: "*",
  manager: [
    "customers.create",
    "customers.update",
    "opportunities.create",
    "opportunities.move",
    "quotes.create",
    "quotes.send",
    "quotes.discount.approve",
    "tasks.create",
    "tasks.complete",
    "members.invite",
    "data.export",
  ],
  sales: [
    "customers.create",
    "customers.update",
    "opportunities.create",
    "opportunities.move",
    "quotes.create",
    "quotes.send",
    "tasks.create",
    "tasks.complete",
  ],
  finance: ["billing.manage", "data.export"],
  viewer: [],
};

export function allowed(role: Role, permission: Permission) {
  const grant = GRANTS[role];
  return grant === "*" || grant.includes(permission);
}

export function canSeeCustomer(me: Member, customer: Customer) {
  if (me.role !== "sales") return true;
  return customer.ownerId === me.id;
}

export function canSeeOpportunity(me: Member, opportunity: Opportunity, customers: Customer[]) {
  if (me.role !== "sales") return true;
  if (opportunity.assigneeId === me.id) return true;
  const customer = customers.find((c) => c.id === opportunity.customerId);
  return customer ? customer.ownerId === me.id : false;
}

export function canSeeQuote(me: Member, quote: Quote, customers: Customer[]) {
  if (me.role !== "sales") return true;
  if (quote.ownerId === me.id) return true;
  const customer = customers.find((c) => c.id === quote.customerId);
  return customer ? customer.ownerId === me.id : false;
}

export function canSeeTask(me: Member, task: Task) {
  if (me.role !== "sales") return true;
  return task.assigneeId === me.id;
}
