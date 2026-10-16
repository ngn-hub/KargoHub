import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import PWARegistration from "@/components/pwa/PWARegistration";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "KargoHub — B2B Wholesale Ordering Platform",
  description:
    "Private B2B wholesale platform with client-specific tier pricing, atomic stock reservation, and offline driver fulfillment.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KargoHub",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50 text-slate-900 antialiased">
      <body
        className={`${inter.className} min-h-full flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white`}
      >
        <AuthProvider>
          <CartProvider>
            {children}
            <PWARegistration />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
