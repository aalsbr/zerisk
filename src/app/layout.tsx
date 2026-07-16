import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/providers";

export const metadata: Metadata = {
  title: "ZeRisk — منصة تحسين قرارات الاحتيال",
  description:
    "An intelligent fraud decision-optimization layer that reduces false declines and operational cost while preserving fraud protection.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
