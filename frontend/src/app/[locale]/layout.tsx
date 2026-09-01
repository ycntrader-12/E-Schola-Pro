import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import Providers from "../providers";
import Navbar from "@/components/Navbar";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "E-Schola Pro",
  description: "Modern E-learning platform",
};

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body className={`${inter.variable} min-h-screen bg-background text-text-primary overflow-x-hidden transition-colors duration-300`}>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            {/* Decorative background blurs (mostly visible in dark mode, adjust opacity if needed) */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none z-[-1] dark:bg-primary/20 bg-primary/10" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/20 blur-[120px] pointer-events-none z-[-1] dark:bg-secondary/20 bg-secondary/10" />
            
            <Navbar />
            <main className="relative z-0 min-h-screen">
              {children}
            </main>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
