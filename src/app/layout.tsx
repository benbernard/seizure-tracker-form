import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import QueryProvider from "./QueryProvider";
import { PatientProvider } from "./components/PatientContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Seizure Tracker",
  description: "Track and monitor seizure activity",
  icons: {
    icon: "/seizure.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geist.variable} ${geistMono.variable} font-sans bg-zinc-900`}
      >
        <QueryProvider>
          <PatientProvider>
            {children}
            <ToastContainer position="bottom-right" theme="dark" />
          </PatientProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
