import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpeakBoy",
  description: "Let AI represent your pet in an SMS thread."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
