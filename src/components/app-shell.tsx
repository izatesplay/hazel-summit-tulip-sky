import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Columns3,
  CreditCard,
  FileText,
  LayoutDashboard,
  ListChecks,
  Menu,
  Package,
  ScrollText,
  Search,
  Settings,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { cn } from "@/lib/cn";
import { memberName, useWorkspace } from "@/lib/roshdyar/use-workspace";
import { ROLE_LABEL, type Role } from "@/lib/roshdyar/types";

const NAV = [
  { to: "/", label: "داشبورد", icon: LayoutDashboard, group: "امروز" },
  { to: "/tasks", label: "پیگیری‌ها", icon: ListChecks, group: "امروز" },
  { to: "/activities", label: "فعالیت‌ها", icon: ScrollText, group: "امروز" },
  { to: "/customers", label: "مشتریان", icon: Users, group: "فروش" },
  { to: "/pipeline", label: "قیف فروش", icon: Columns3, group: "فروش" },
  { to: "/quotes", label: "پیشنهاد قیمت", icon: FileText, group: "فروش" },
  { to: "/services", label: "خدمات", icon: Package, group: "فروش" },
  { to: "/automations", label: "اتوماسیون", icon: Zap, group: "رشد" },
  { to: "/reports", label: "گزارش‌ها", icon: BarChart3, group: "رشد" },
  { to: "/team", label: "تیم", icon: Users, group: "سازمان" },
  { to: "/billing", label: "اشتراک", icon: CreditCard, group: "سازمان" },
  { to: "/settings", label: "تنظیمات", icon: Settings, group: "سازمان" },
] as const;

const MOBILE = [
  { to: "/", label: "امروز", icon: LayoutDashboard },
  { to: "/customers", label: "مشتری", icon: Users },
  { to: "/pipeline", label: "قیف", icon: Columns3 },
  { to: "/quotes", label: "پیشنهاد", icon: FileText },
  { to: "/tasks", label: "پیگیری", icon: ListChecks },
] as const;

function active(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ws = useWorkspace();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [bell, setBell] = useState(false);
  const [who, setWho] = useState(false);
  const unread = ws.notices.filter((n) => !n.read).length;
  const hits = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return ws.customers.filter((c) => c.name.includes(q) || c.phone.includes(q) || c.email.includes(q)).slice(0, 6);
  }, [query, ws.customers]);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <Toaster position="top-center" dir="rtl" theme="dark" />
      <div className="lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside className="no-print sticky top-0 hidden h-screen flex-col border-e border-line bg-surface lg:flex">
          <Brand />
          <Nav pathname={pathname} />
          <UserChip name={ws.me.name} role={ws.me.role} onClick={() => setWho(true)} />
        </aside>
        <div className="min-w-0">
          <header className="no-print sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg/95 px-3 py-2 backdrop-blur lg:px-6">
            <button className="grid h-11 w-11 place-items-center rounded-lg border border-line lg:hidden" onClick={() => setOpen(true)} aria-label="منو">
              <Menu size={18} />
            </button>
            <div className="relative min-w-0 flex-1">
              <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جست‌وجوی مشتری، شماره یا ایمیل"
                className="h-11 w-full rounded-lg border border-line bg-surface ps-10 pe-3 text-base outline-none placeholder:text-faint"
              />
              {hits.length > 0 ? (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface">
                  {hits.map((c) => (
                    <Link key={c.id} to="/customers/$customerId" params={{ customerId: c.id }} onClick={() => setQuery("")} className="block px-3 py-3 text-sm hover:bg-raised">
                      <span className="font-medium">{c.name}</span>
                      <span className="mt-0.5 block text-xs text-muted">{c.phone}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              className="relative grid h-11 w-11 place-items-center rounded-lg border border-line"
              aria-label="اعلان‌ها"
              onClick={() => {
                setBell((v) => !v);
                ws.markNoticesRead();
              }}
            >
              <Bell size={18} />
              {unread > 0 ? <span className="absolute top-2 end-2 h-2 w-2 rounded-full bg-primary" /> : null}
            </button>
            {bell ? (
              <div className="absolute end-3 top-16 z-20 w-[min(22rem,calc(100vw-1.5rem))] rounded-card border border-line bg-surface p-2">
                {ws.notices.slice(0, 6).map((n) => (
                  <a key={n.id} href={n.href || "/"} className="block rounded-lg px-3 py-2 hover:bg-raised" onClick={() => setBell(false)}>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted">{n.body}</p>
                  </a>
                ))}
                {ws.notices.length === 0 ? <p className="px-3 py-4 text-sm text-muted">اعلانی نیست.</p> : null}
              </div>
            ) : null}
          </header>
          {ws.me.role !== "owner" ? (
            <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-line bg-raised px-4 py-2 text-sm">
              <p>
                نمای نقش: <span className="font-semibold">{ws.me.name}</span>
                <span className="text-muted"> · {ROLE_LABEL[ws.me.role]}</span>
              </p>
              <button className="text-primary" onClick={() => ws.setMe("m_sara")}>
                بازگشت به مالک
              </button>
            </div>
          ) : null}
          <main className="px-4 py-5 pb-24 lg:px-8 lg:py-8 lg:pb-10">{children}</main>
        </div>
      </div>
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface lg:hidden">
        {MOBILE.map((item) => {
          const Icon = item.icon;
          const on = active(pathname, item.to);
          return (
            <Link key={item.to} to={item.to} className={cn("grid h-16 place-items-center text-xs", on ? "text-primary" : "text-muted")}>
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-bg/70" aria-label="بستن منو" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col border-e border-line bg-surface">
            <div className="flex items-center justify-between">
              <Brand />
              <button className="me-3 grid h-11 w-11 place-items-center" onClick={() => setOpen(false)} aria-label="بستن">
                <X size={18} />
              </button>
            </div>
            <div onClick={() => setOpen(false)}>
              <Nav pathname={pathname} />
            </div>
            <UserChip
              name={ws.me.name}
              role={ws.me.role}
              onClick={() => {
                setOpen(false);
                setWho(true);
              }}
            />
          </div>
        </div>
      ) : null}
      {who ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-bg/70 p-4 sm:place-items-center" onClick={() => setWho(false)}>
          <div className="w-full max-w-md rounded-card border border-line bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">نمای نقش</h2>
            <p className="mt-1 text-sm text-muted">برای دیدن تفاوت دسترسی‌ها، نقش را عوض کنید. در محصول نهایی این انتخاب سمت سرور و بر اساس عضویت واقعی است.</p>
            <div className="mt-3 grid gap-2">
              {ws.members.filter((m) => m.active).map((m) => (
                <button
                  key={m.id}
                  className={cn("flex items-center justify-between rounded-lg border px-3 py-3 text-start", m.id === ws.meId ? "border-primary bg-primary/10" : "border-line")}
                  onClick={() => {
                    ws.setMe(m.id);
                    setWho(false);
                    toast.success(`نمای ${m.name}`);
                  }}
                >
                  <span>
                    <span className="block font-medium">{m.name}</span>
                    <span className="text-xs text-muted">{ROLE_LABEL[m.role]}</span>
                  </span>
                  <span className="text-xs text-faint">{memberName(ws.members, m.id) === ws.me.name && m.id === ws.meId ? "فعال" : ""}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3 px-4 py-4">
      <span className="flex h-9 w-9 items-end justify-center gap-0.5 rounded-lg bg-bg px-1.5 py-1.5">
        <span className="h-2 w-1 rounded-sm bg-good" />
        <span className="h-3.5 w-1 rounded-sm bg-primary" />
        <span className="h-5 w-1 rounded-sm bg-fg" />
      </span>
      <span>
        <span className="block text-base font-extrabold leading-none">رشدیار</span>
        <span className="mt-1 block text-xs text-muted">آوان راهبرد</span>
      </span>
    </Link>
  );
}

function Nav({ pathname }: { pathname: string }) {
  let last = "";
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const on = active(pathname, item.to);
        const head = item.group !== last;
        last = item.group;
        return (
          <div key={item.to}>
            {head ? <p className="px-3 pb-1 pt-3 text-xs text-faint">{item.group}</p> : null}
            <Link
              to={item.to}
              className={cn(
                "flex h-11 items-center gap-2 rounded-lg px-3 text-sm",
                on ? "border-s-2 border-primary bg-raised font-semibold text-fg" : "text-muted",
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

function UserChip({ name, role, onClick }: { name: string; role: Role; onClick: () => void }) {
  return (
    <button onClick={onClick} className="m-3 flex items-center gap-3 rounded-lg border border-line px-3 py-3 text-start">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-ink">{name.slice(0, 1)}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="block text-xs text-muted">{ROLE_LABEL[role]}</span>
      </span>
    </button>
  );
}
