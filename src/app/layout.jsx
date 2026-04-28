import "./globals.css";
export const metadata = {
    title: "ExampleHR Time Off",
    description: "Time-off microservice and HCM reconciliation demo"
};
export default function RootLayout({ children }) {
    return (<html lang="en">
      <body>{children}</body>
    </html>);
}
