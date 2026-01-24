// src/components/ui/button.jsx
"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const buttonVariants = {
  default:
    "inline-flex items-center justify-center rounded-xl bg-brand-primary px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70 disabled:pointer-events-none disabled:opacity-60",
  outline:
    "inline-flex items-center justify-center rounded-xl border border-admin-border bg-white px-4 py-2 text-xs font-medium text-admin-text shadow-sm transition hover:bg-admin-surfaceMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60 disabled:pointer-events-none disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-medium text-admin-text transition hover:bg-admin-surfaceMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60 disabled:pointer-events-none disabled:opacity-60",
};

const Button = React.forwardRef(
  (
    {
      className,
      variant = "default",
      asChild = false,
      type = "button",
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(
          buttonVariants[variant] || buttonVariants.default,
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
