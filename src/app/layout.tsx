import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const font = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
});

// Giữ bí mật bất ngờ (mục 9): tiêu đề, mô tả, biểu tượng không có chữ "cầu hôn" hay "nhẫn".
const title = process.env.NEXT_PUBLIC_APP_TITLE || "Cuộc Đua Bí Mật";

export const metadata: Metadata = {
  title,
  description: "Sẵn sàng chưa? Cuộc đua bắt đầu!",
  robots: { index: false, follow: false },
  appleWebApp: { capable: false, title },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#101320",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${font.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
