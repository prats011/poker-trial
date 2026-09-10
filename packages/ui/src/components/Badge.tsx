import type { HTMLAttributes, PropsWithChildren } from "react";

export function Badge({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLSpanElement>>) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-[#30363d] bg-[#0f1115] px-2 py-0.5 text-xs text-[#8b949e] ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
