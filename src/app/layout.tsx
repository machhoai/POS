import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "goey-toast/styles.css";
import "./globals.css";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import ToastProvider from "@/components/providers/ToastProvider";
import ResilienceProvider from "@/components/resilience/ResilienceProvider";
import DeviceActivationGate from "@/components/device/DeviceActivationGate";

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
        <ResilienceProvider>
          <DeviceActivationGate>
            <AuthProvider>{children}</AuthProvider>
          </DeviceActivationGate>
        </ResilienceProvider>
        <ToastProvider />
        <Script
          type="module"
          src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"
          strategy="lazyOnload"
        />
        <Script
          noModule
          src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
