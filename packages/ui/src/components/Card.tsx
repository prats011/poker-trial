import type { HTMLAttributes, PropsWithChildren } from "react";

export function Card({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={`rounded-xl border border-[#30363d] bg-[#161b22] p-4 ${className}`} {...props}>
      {children}
    </div>
  );
}
