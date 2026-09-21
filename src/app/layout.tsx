import type { Metadata } from "next"
import "./globals.css"
import AppShell from "@/components/AppShell"
import Providers from "@/components/Providers"
import { GameProtectionProvider } from "@/contexts/GameProtectionContext"
import { FlashMessageProvider } from "@/contexts/FlashMessageContext"
import FlashMessages from "@/components/FlashMessages"

export const metadata: Metadata = {
  title: "Yams Tour par Tour",
  description: "Jeu de Yams en temps réel avec Next.js et Supabase",
  icons: {
    icon: '/icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.documentElement.setAttribute('data-theme', 'yams-dark');
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-base-100 text-base-content">
        <Providers>
          <FlashMessageProvider>
            <GameProtectionProvider>
              <AppShell>{children}</AppShell>
              <FlashMessages />
            </GameProtectionProvider>
          </FlashMessageProvider>
        </Providers>
      </body>
    </html>
  )
}
