import { Suspense } from "react";
import Link from "next/link";
import "./globals.css";
import AccountMenu from "../components/AccountMenu";
import AnnouncementBar from "../components/AnnouncementBar";
import AuthModal from "../components/AuthModal";
import { AuthProvider } from "../components/AuthProvider";
import CartBadge from "../components/CartBadge";
import CategoryNav from "../components/CategoryNav";
import Footer from "../components/Footer";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { LanguageProvider } from "../components/LanguageProvider";
import SearchBar from "../components/SearchBar";
import T from "../components/T";
import ThemeToggle from "../components/ThemeToggle";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/storefront";

// Real — fetched from the same Organization row staff edit in the admin's
// Settings > Business Profile tab (name + logo). Falls back to null on
// any failure (backend down, no organization configured yet) rather than
// breaking the whole site — callers below fall back to the "site_name"
// translation key and text-only branding when this is null.
async function getOrganization() {
  try {
    const res = await fetch(`${BASE_URL}/organization/`, {
      next: { revalidate: 300 }, // org branding rarely changes — 5 min cache
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata() {
  const org = await getOrganization();
  return {
    title: org?.name || "PonnoSomver",
    description: "pos_v1 storefront",
  };
}

export default async function RootLayout({ children }) {
  const org = await getOrganization();

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
          <AuthProvider>
            <AnnouncementBar />

            <header className="border-b border-gray-200 dark:border-gray-800">
              <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2 shrink-0">
                  {org?.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={org.logo} alt={org.name} className="h-8 w-8 object-contain rounded" />
                  ) : null}
                  <span className="font-heading text-xl font-semibold text-brand-700 dark:text-brand-500">
                    {org?.name || <T id="site_name" />}
                  </span>
                </Link>
                <nav className="flex gap-6 text-sm shrink-0">
                  <Link href="/" className="text-gray-700 dark:text-gray-300 hover:text-brand-600"><T id="nav_home" /></Link>
                  <Link href="/products" className="text-gray-700 dark:text-gray-300 hover:text-brand-600"><T id="nav_shop" /></Link>
                </nav>

                <SearchBar />

                <div className="ml-auto flex items-center gap-3">
                  <LanguageSwitcher />
                  <ThemeToggle />
                  <AccountMenu />
                  <CartBadge />
                </div>
              </div>
            </header>

            <Suspense fallback={null}>
              <CategoryNav />
            </Suspense>

            <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>

            <Footer org={org} />

            <AuthModal />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
