import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { Header } from "@/components/layout/Header";
import { BoardStatusProvider } from "@/components/canvas/BoardStatusContext";

export const metadata: Metadata = {
  title: "Whiteboard",
  description: "Collaborative whiteboard application",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SupabaseProvider>
          <BoardStatusProvider>
            <Header />
            {children}
          </BoardStatusProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
