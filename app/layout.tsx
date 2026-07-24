import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Birdtown",
  description: "A browser instrument made from the live CO.BIRD.00.HHZ waveform.",
  icons: {
    icon: [{ url: "/favicon.gif", type: "image/gif" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
