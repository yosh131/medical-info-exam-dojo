import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { PwaRegistration } from "@/components/PwaRegistration";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const metadata: Metadata = {
  title: "過去問道場", description: "医療情報技師試験の個人学習用PWA",
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "過去問道場" },
  icons: { icon: `${basePath}/icon.svg`, apple: `${basePath}/icon.svg` }
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b6b58" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body><PwaRegistration/><main className="app-shell">{children}</main><BottomNav/></body></html>;
}
