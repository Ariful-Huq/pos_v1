import { Suspense } from "react";
import Link from "next/link";
import "./globals.css";
import AnnouncementBar from "../components/AnnouncementBar";
import CartBadge from "../components/CartBadge";
import CategoryNav from "../components/CategoryNav";
import Footer from "../components/Footer";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { LanguageProvider } from "../components/LanguageProvider";
import SearchBar from "../components/SearchBar";
import T from "../components/T";
import ThemeToggle from "../components/ThemeToggle";

export const metadata = {
  title: "Store",
  description: "pos_v1 storefront",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Sets the initial `dark` class before paint, so there's no
            light-flash on reload for users who already chose dark mode. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const stored = localStorage.getItem('storefront_theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (stored ? stored === 'dark' : prefersDark) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />

        <LanguageProvider>
          <AnnouncementBar />

          <header className="border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center gap-6">
            <Link href="/" className="font-heading text-xl font-semibold text-brand-700 dark:text-brand-500 shrink-0">
              Store
            </Link>
            <nav className="flex gap-6 text-sm shrink-0">
              <Link href="/" className="text-gray-700 dark:text-gray-300 hover:text-brand-600"><T id="nav_home" /></Link>
              <Link href="/products" className="text-gray-700 dark:text-gray-300 hover:text-brand-600"><T id="nav_shop" /></Link>
            </nav>

            <SearchBar />

            <div className="ml-auto flex items-center gap-3">
              <LanguageSwitcher />
              <ThemeToggle />
              <CartBadge />
            </div>
          </header>

          <Suspense fallback={null}>
            <CategoryNav />
          </Suspense>

          <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>

          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
