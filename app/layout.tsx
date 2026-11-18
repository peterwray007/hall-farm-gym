import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.hallfarmgym.com"),
  title: "Hall Farm Gym Shop",
  description: "Pay for drinks, snacks and WrayFitness clothing at Hall Farm Gym.",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        {children}
        <footer className="sitefooter">The Hall Farm Gym · Operated by Peter Wray trading as WrayFitness</footer>
      </body>
    </html>
  );
}
