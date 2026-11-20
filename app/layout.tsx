import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Editorial display face. Variable axes: optical size + softness, used by the wordmark and headings.
const display = Fraunces({ variable: "--font-display", subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz", "SOFT"] });

const siteUrl = (() => { try { return process.env.APP_URL ? new URL(process.env.APP_URL) : undefined; } catch { return undefined; } })();
const description = "Book single satellite passes at verified ground stations. Fees wait in escrow and are released only for downlink frames proven delivered.";
export const metadata: Metadata = {
  // APP_URL is the public address of the deployment (see .env.example); it makes share-card links absolute.
  metadataBase: siteUrl,
  title: "OrbitPass — Ground time, on your terms",
  description,
  applicationName: "OrbitPass",
  openGraph: { title: "OrbitPass — Ground time, on your terms", description, siteName: "OrbitPass", type: "website" },
  twitter: { card: "summary", title: "OrbitPass", description },
};
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#05080f" }, { color: "#05080f" }] };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster theme="light" position="bottom-right" />
      </body>
    </html>
  );
}
