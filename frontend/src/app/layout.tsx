import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocVoice AI – Document to Speech",
  description:
    "Upload PDF or Word documents and convert them to natural-sounding speech instantly.",
  keywords: ["text to speech", "PDF reader", "document audio", "TTS", "DocVoice"],
  openGraph: {
    title: "DocVoice AI",
    description: "Transform your documents into audio — instantly.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
