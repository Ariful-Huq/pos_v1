import Link from "next/link";
import T from "../components/T";

export default function HomePage() {
  return (
    <div className="text-center py-16">
      <h1 className="font-heading text-4xl font-bold text-brand-700 dark:text-brand-500 mb-4">
        <T id="home_title" />
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8"><T id="home_subtitle" /></p>
      <Link
        href="/products"
        className="inline-block bg-accent-500 text-white px-6 py-3 rounded-md font-medium hover:bg-accent-400"
      >
        <T id="home_cta" />
      </Link>
    </div>
  );
}
