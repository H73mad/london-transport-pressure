import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOTION — London transport picture",
  description: "A clear, map-led view of London transport reliability, road pressure and the context behind each review point.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
