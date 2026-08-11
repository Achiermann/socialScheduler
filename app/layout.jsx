import "./globals.css";

export const metadata = { title: "Social Scheduler" };

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
