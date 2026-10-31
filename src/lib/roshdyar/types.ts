export type Role = "owner" | "manager" | "sales" | "finance" | "viewer";

export type CustomerStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type StageId =
  | "new"
  | "contacted"
  | "discovery"
  | "ready"
  | "sent"
  | "negotiation"
  | "won"
  | "lost";

export type QuoteStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "SENT"
  | "VIEWED"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED"
  | "SUPERSEDED";

export type TaskStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  active: boolean;
};

export type Org = {
  name: string;
  legalName: string;
  phone: string;
  email: string;
  address: string;
  timezone: "Asia/Tehran";
  quotePrefix: string;
  taxPercent: number;
  followUpDays: number;
  staleDays: number;
  discountCaps: Record<Role, number>;
};

export type Customer = {
  id: string;
  kind: "company" | "person";
  name: string;
  phone: string;
  email: string;
  source: string;
  ownerId: string;
  status: CustomerStatus;
  priority: "low" | "normal" | "high";
  tags: string[];
  notes: string;
  createdAt: string;
  lastActivityAt: string;
};

export type Contact = {
  id: string;
  customerId: string;
  name: string;
  roleTitle: string;
  phone: string;
  email: string;
};

export type Opportunity = {
  id: string;
  customerId: string;
  title: string;
  stage: StageId;
  amount: number;
  probability: number;
  assigneeId: string;
  closeDate?: string;
  finalAmount?: number;
  wonAt?: string;
  lostReason?: string;
  competitor?: string;
  stageEnteredAt: string;
  createdAt: string;
};

export type StageMove = {
  id: string;
  opportunityId: string;
  from: StageId | null;
  to: StageId;
  at: string;
  byId: string;
  note?: string;
};

export type Service = {
  id: string;
  name: string;
  category: string;
  code: string;
  unit: string;
  price: number;
  description: string;
  active: boolean;
};

export type QuoteItem = {
  id: string;
  serviceId?: string;
  title: string;
  qty: number;
  unitPrice: number;
  unit: string;
};

export type Quote = {
  id: string;
  number: string;
  customerId: string;
  opportunityId?: string;
  status: QuoteStatus;
  items: QuoteItem[];
  discountPercent: number;
  taxPercent: number;
  terms: string;
  notes: string;
  validUntil: string;
  createdAt: string;
  sentAt?: string;
  viewedAt?: string;
  respondedAt?: string;
  responseNote?: string;
  token: string;
  ownerId: string;
  parentQuoteId?: string;
  version: number;
};

export type QuoteEvent = {
  id: string;
  quoteId: string;
  type: string;
  at: string;
  note?: string;
};

export type Task = {
  id: string;
  title: string;
  notes: string;
  customerId?: string;
  opportunityId?: string;
  quoteId?: string;
  creatorId: string;
  assigneeId: string;
  dueAt: string;
  priority: "low" | "normal" | "high";
  status: TaskStatus;
  result?: string;
  completedAt?: string;
  source: "manual" | "system" | "automation";
  idempotencyKey?: string;
  createdAt: string;
};

export type Activity = {
  id: string;
  kind: "note" | "call" | "meeting" | "system";
  customerId?: string;
  opportunityId?: string;
  quoteId?: string;
  authorId: string;
  title: string;
  body?: string;
  at: string;
};

export type Automation = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: "quote.sent" | "opportunity.stale";
  delayDays: number;
};

export type AutomationRun = {
  id: string;
  automationId: string;
  at: string;
  ok: boolean;
  summary: string;
  idempotencyKey: string;
};

export type Notice = {
  id: string;
  at: string;
  title: string;
  body: string;
  href?: string;
  read: boolean;
};

export type Invitation = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "pending" | "cancelled";
  createdAt: string;
};

export type Data = {
  org: Org;
  members: Member[];
  meId: string;
  customers: Customer[];
  contacts: Contact[];
  opportunities: Opportunity[];
  stageMoves: StageMove[];
  services: Service[];
  quotes: Quote[];
  quoteEvents: QuoteEvent[];
  tasks: Task[];
  activities: Activity[];
  automations: Automation[];
  automationRuns: AutomationRun[];
  notices: Notice[];
  invitations: Invitation[];
  quoteSeq: number;
  aiUses: number;
};

export const STAGES: { id: StageId; label: string; kind: "open" | "won" | "lost" }[] = [
  { id: "new", label: "سرنخ جدید", kind: "open" },
  { id: "contacted", label: "تماس اولیه", kind: "open" },
  { id: "discovery", label: "نیازسنجی", kind: "open" },
  { id: "ready", label: "آماده پیشنهاد", kind: "open" },
  { id: "sent", label: "پیشنهاد ارسال شد", kind: "open" },
  { id: "negotiation", label: "مذاکره", kind: "open" },
  { id: "won", label: "فروش موفق", kind: "won" },
  { id: "lost", label: "فروش ناموفق", kind: "lost" },
];

export const OPEN_STAGES = STAGES.filter((s) => s.kind === "open").map((s) => s.id);

export const CUSTOMER_STATUS: Record<CustomerStatus, string> = {
  NEW: "سرنخ جدید",
  CONTACTED: "تماس‌گرفته",
  QUALIFIED: "واجد شرایط",
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
  ARCHIVED: "بایگانی",
};

export const QUOTE_STATUS: Record<QuoteStatus, string> = {
  DRAFT: "پیش‌نویس",
  PENDING_APPROVAL: "منتظر تأیید",
  SENT: "ارسال‌شده",
  VIEWED: "دیده‌شده",
  ACCEPTED: "پذیرفته",
  REJECTED: "ردشده",
  EXPIRED: "منقضی",
  CANCELLED: "لغوشده",
  SUPERSEDED: "جایگزین‌شده",
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: "مالک سازمان",
  manager: "مدیر فروش",
  sales: "کارشناس فروش",
  finance: "مسئول مالی",
  viewer: "ناظر",
};

export const LOST_REASONS = ["قیمت", "زمان‌بندی", "انتخاب رقیب", "نبود نیاز واقعی", "عدم پاسخ", "سایر"] as const;

export const SOURCES = ["معرفی", "وب‌سایت", "تماس ورودی", "نمایشگاه", "اینستاگرام", "کمپین", "سایر"] as const;

export const DEFAULT_TERMS =
  "اعتبار پیشنهاد تا تاریخ درج‌شده است. پذیرش پیشنهاد به‌تنهایی به معنی دریافت وجه یا انعقاد قرارداد نیست. شروع کار پس از تأیید کتبی دامنه و زمان‌بندی انجام می‌شود. مالیات طبق تنظیم سازمان روی مبلغ پس از تخفیف محاسبه شده است.";
