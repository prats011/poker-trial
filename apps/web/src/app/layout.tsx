import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker Trial",
  description: "Phase 1 shell for realtime poker"
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#0f1115] text-[#f5f7fa]">{children}</body>
    </html>
  );
}
