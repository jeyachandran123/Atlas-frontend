import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { QueryProvider } from "@/app/providers";
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
  title: "UnityWorks — AI Assistant",
  description: "A self-hosted AI assistant grounded in your codebase.",
};

/**
 * Without this a phone lays the page out at ~980px and scales the result down,
 * which is why the app read as tiny rather than merely cramped on a small
 * screen. `viewportFit: cover` is what lets the layout below claim the area
 * behind a notch and the iOS home indicator via env(safe-area-inset-*).
 *
 * No `maximumScale` on purpose: capping zoom would stop anyone who needs to
 * magnify text from doing so.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The on-screen keyboard shrinks the layout viewport instead of shoving the
  // page up behind it. h-dvh then recalculates, so the composer sits on top of
  // the keyboard and the conversation scrolls underneath — rather than the
  // whole page sliding and taking the header with it.
  interactiveWidget: "resizes-content",
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
