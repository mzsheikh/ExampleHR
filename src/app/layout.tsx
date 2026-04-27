import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExampleHR Time Off",
  description: "Time-off microservice and HCM reconciliation demo"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
