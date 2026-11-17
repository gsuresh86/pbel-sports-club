import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { themeInitScript } from "@/lib/theme-script";
import { Analytics } from "@vercel/analytics/next";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.tourneycraft.app"),
  title: {
    default: "TourneyCraft — Run Sports Tournaments End to End",
    template: "%s | TourneyCraft",
  },
  description:
    "TourneyCraft helps clubs, communities, and organisations run sports tournaments end to end — online registration, smart draws, live scoring, and results.",
  keywords: [
    "tournament management",
    "sports tournament",
    "badminton tournament",
    "table tennis tournament",
    "volleyball tournament",
    "live scoring",
    "TourneyCraft",
    "Hyderabad sports",
  ],
  authors: [{ name: "TourneyCraft" }],
  openGraph: {
    siteName: "TourneyCraft",
    type: "website",
    locale: "en_IN",
    title: "TourneyCraft — Run Sports Tournaments End to End",
    description:
      "Run any sports tournament end-to-end — from the first registration to the final podium.",
    url: "https://www.tourneycraft.app",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "TourneyCraft — Run Sports Tournaments End to End",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TourneyCraft — Run Sports Tournaments End to End",
    description:
      "Run any sports tournament end-to-end — from the first registration to the final podium.",
    images: ["/twitter-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    title: "TourneyCraft",
    statusBarStyle: "default",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${plusJakartaSans.variable} font-plus-jakarta-sans antialiased`}
      >
        <AppProviders>
          {children}
        </AppProviders>
        <Analytics />
      </body>
    </html>
  );
}
