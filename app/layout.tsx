import type { Metadata } from "next";
import "./globals.css";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";

export const metadata: Metadata = {
  title: "Whiteboard",
  description: "Collaborative whiteboard application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
