import type { Metadata } from "next";
import localFont from "next/font/local";
import { Nunito } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-friendly-sans",
  weight: ["400", "500", "600", "700", "800"],
});

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Bounan Dashboard",
  description: "Operational dashboard for token configuration and backup analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${nunito.variable} ${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-950 font-sans text-slate-50 antialiased`}
      >
        {children}
        <Toaster
          theme="dark"
          richColors
          position="top-right"
          toastOptions={{
            className: "border border-slate-800 bg-slate-950 text-slate-50",
          }}
        />
      </body>
    </html>
  );
}
