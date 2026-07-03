import "./globals.css";

export const metadata = {
  title: "Office Watch",
  description: "Simulated office device monitor with live dashboard and alerts.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

