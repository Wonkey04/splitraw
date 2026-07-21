import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SplitRaw Admin",
  description: "SplitRaw gym admin dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-bg font-sans text-text-primary">{children}</body>
    </html>
  );
}
