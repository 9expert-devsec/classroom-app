import "./globals.css";

export const metadata = {
  title: "9Expert Register",
  description: "Classroom check-in + Admin system",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        {/* iPad / iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="9Expert Register" />
        <link rel="apple-touch-icon" href="/logo-9expert-app.png" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </head>
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
