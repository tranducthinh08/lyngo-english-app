import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Navbar from "@/components/common/Navbar";
import CatCursor from "@/components/common/CatCursor";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Lyngo - Đọc Sách Giấy & Ghi Nhớ Kiểu Cô Ly",
  description: "Ứng dụng quét sách giấy bằng AI, tra cứu Cambridge Dictionary, ghi chú cá nhân hóa kèm ảnh và trợ lý đọc giọng tiếng Anh bản ngữ.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#faf7f2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#faf7f2] text-amber-950 min-h-screen selection:bg-amber-200 selection:text-amber-950`}
      >
        <CatCursor />
        <Navbar />
        <div className="min-h-[calc(100vh-4rem)]">
          {children}
        </div>
      </body>
    </html>
  );
}
