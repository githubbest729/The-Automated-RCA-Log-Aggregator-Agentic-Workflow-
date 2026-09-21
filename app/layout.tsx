import type { Metadata } from "next";
import "./globals.css";

// NOTE: og-image.png, favicon.ico, and apple-touch-icon.png must be added to
// /public manually — see public/ASSETS_README.md for exact specs and paths.

const SITE_URL = "https://the-automated-rca-log-aggregator-ag-drab.vercel.app"; // TODO: replace with your production URL

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Automated RCA Log Aggregator",
    template: "%s | Automated RCA Log Aggregator",
  },
  description:
    "Upload SCADA, Windows Event, and SQL Server logs and get an AI-generated, chronological root-cause-analysis timeline of cascading failures leading up to a system crash.",
  keywords: [
    "SCADA",
    "root cause analysis",
    "RCA",
    "log aggregation",
    "industrial automation",
    "Windows Event Log",
    "SQL Server trace",
    "incident timeline",
  ],
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "Automated RCA Log Aggregator",
    description:
      "Turn disparate SCADA, Windows, and SQL logs into a unified AI-analyzed incident timeline.",
    url: SITE_URL,
    siteName: "Automated RCA Log Aggregator",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Automated RCA Log Aggregator",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Automated RCA Log Aggregator",
    description:
      "Turn disparate SCADA, Windows, and SQL logs into a unified AI-analyzed incident timeline.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-base-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
