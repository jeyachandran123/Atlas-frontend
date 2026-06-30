import type { Metadata } from "next";
import { Toaster } from "sonner";
import { QueryProvider } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas — AI Coding Assistant",
  description: "A self-hosted AI coding assistant grounded in your codebase.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <QueryProvider>
          {children}
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
