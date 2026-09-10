import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-md border border-[#30363d] bg-[#0f1115] px-3 py-2 text-sm text-[#f5f7fa] outline-none ring-[#2f81f7] focus:ring-2 ${className}`}
      {...props}
    />
  );
}
