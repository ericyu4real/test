// src/app/layout.tsx
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthWrapper } from "@/components/AuthWrapper";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AuthWrapper>{children}</AuthWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
