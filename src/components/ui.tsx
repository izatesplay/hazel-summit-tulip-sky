import * as Dialog from "@radix-ui/react-dialog";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatToman, formatTomanShort } from "@/lib/roshdyar/format";

export const fieldClass =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-base text-fg outline-none placeholder:text-faint";

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-primary text-primary-ink",
    quiet: "border border-line bg-raised text-fg",
    ghost: "text-muted hover:bg-raised hover:text-fg",
    danger: "bg-bad text-primary-ink",
  }[variant];
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-opacity disabled:opacity-40",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "bad" | "warn";
  children: ReactNode;
}) {
  const styles = {
    neutral: "bg-raised text-muted",
    good: "bg-good/15 text-good",
    bad: "bg-bad/15 text-bad",
    warn: "bg-primary/15 text-primary",
  }[tone];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", styles)}>{children}</span>;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-card border border-line bg-surface p-4", className)}>{children}</section>;
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-balance text-2xl font-bold">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-pretty text-sm text-muted">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </header>
  );
}

export function Money({ value, short = false }: { value: number; short?: boolean }) {
  return (
    <span className="tabular-nums">
      {short ? formatTomanShort(value) : formatToman(value)}
      <span className="ms-1 text-xs font-normal text-muted">تومان</span>
    </span>
  );
}

export function MoneyText({ value }: { value: number }) {
  return <span className="tabular-nums">{formatToman(value)}</span>;
}

export function Modal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/80" />
        <Dialog.Content className="fixed inset-x-3 top-6 z-50 max-h-[88vh] overflow-y-auto rounded-card border border-line bg-surface p-5 md:inset-x-auto md:left-1/2 md:w-[32rem] md:-translate-x-1/2">
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
            <Dialog.Close className="text-sm text-muted">بستن</Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card border border-dashed border-line px-4 py-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}
