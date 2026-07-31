import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "goey-toast/styles.css";
import "./globals.css";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import ToastProvider from "@/components/providers/ToastProvider";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hệ Thống POS",
  description: "Hệ thống bán hàng Local-First với đồng bộ thời gian thực",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
        <ToastProvider />
      </body>
    </html>
  );
}
