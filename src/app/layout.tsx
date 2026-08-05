import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";

const geist = Geist({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Titular",
  description:
    "Tus noticias de cine, videojuegos, teatro, libros, tecnología y ciencia, ordenadas por lo que te gusta.",
  manifest: "/manifest.webmanifest",
  applicationName: "Titular",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Titular",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0f" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Necesario para que env(safe-area-inset-*) tenga valores reales en iPhone.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <head>
        {/* Aplica el tema guardado ANTES del primer pintado. Sin esto se ve un
            flash del tema por defecto en cada carga. Va inline a propósito:
            cualquier archivo externo llegaría tarde. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=JSON.parse(localStorage.getItem('news.prefs.v1')||'{}').theme;if(t&&t!=='sistema')document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
