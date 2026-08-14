import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AppPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("min-h-screen w-full px-3 py-4", className)}>
      {children}
    </div>
  );
}

const surfaceClasses = {
  default: "app-surface",
  toolbar: "app-toolbar",
  inset: "app-inset-surface",
};

type SurfaceVariant = keyof typeof surfaceClasses;

type SurfaceProps<T extends ElementType> = {
  as?: T;
  children?: ReactNode;
  className?: string;
  variant?: SurfaceVariant;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function Surface<T extends ElementType = "div">({
  as,
  children,
  className,
  variant = "default",
  ...props
}: SurfaceProps<T>) {
  const Component = as ?? "div";

  return (
    <Component className={cx(surfaceClasses[variant], className)} {...props}>
      {children}
    </Component>
  );
}

const noticeClasses = {
  danger: "bg-red-500/10 text-[var(--danger-text)]",
  success: "bg-emerald-500/10 text-[var(--success-text)]",
  warning: "bg-amber-500/10 text-[var(--warning-text)]",
};

export function Notice({
  children,
  className,
  tone,
  ...props
}: {
  children: ReactNode;
  className?: string;
  tone: keyof typeof noticeClasses;
} & Omit<ComponentPropsWithoutRef<"p">, "children" | "className">) {
  return (
    <p
      className={cx(
        "rounded-md px-3 py-2 text-sm",
        noticeClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}
