import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { QueryProvider } from "@/app/providers";
// TypeScript may complain about CSS side-effect imports in some setups.
// @ts-ignore: CSS module side-effect import
import "./globals.css";

// Self-hosted variable fonts — every weight renders crisply (no synthetic
// bolding), zero flash of unstyled text, no runtime Google Fonts request.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jbmono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "UnityWorks — AI Coding Assistant",
  description: "A self-hosted AI coding assistant grounded in your codebase.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
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
