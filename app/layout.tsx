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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('atlas-theme')||'dark';if(t==='system')t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body>
        <QueryProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--toast-bg)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
                boxShadow: "var(--shadow-xl)",
                borderRadius: "12px",
                fontSize: "13px",
                fontFamily: "var(--font-sans)",
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
