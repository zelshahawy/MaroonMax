import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeToggle from "./ThemeToggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Maroon Max",
  description: "Maroon Max is a live powerlifting meet display",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
