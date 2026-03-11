import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { SocketProvider } from "@/providers/socket-provider";

import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Thrive Admin",
  description: "Thrive Sustainability Engagement Admin Panel",
  icons: {
    icon: "/icons/leaf.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <SocketProvider>
                  <TooltipProvider delayDuration={300} skipDelayDuration={0}>
                    {children}
                    <Toaster
                      position="top-right"
                      richColors
                      closeButton
                      toastOptions={{
                        style: {
                          padding: "16px 48px 16px 16px",
                          borderRadius: "12px",
                          fontSize: "14px",
                          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
                        },
                      }}
                    />
                  </TooltipProvider>
              </SocketProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
