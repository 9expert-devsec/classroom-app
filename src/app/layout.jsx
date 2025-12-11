import "./globals.css";

export const metadata = {
  title: "9Expert Classroom",
  description: "Classroom check-in + Admin system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
