import Link from "next/link";
import { ArrowRight, ImageIcon } from "lucide-react";
import T from "./T";

export default function HeroSection() {
  return (
    <section className="grid sm:grid-cols-2 gap-8 items-center mb-14">
      <div>
        <p className="text-xs font-semibold tracking-wide text-accent-500 uppercase mb-2">
          <T id="hero_eyebrow" />
        </p>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          <T id="hero_heading" />
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          <T id="hero_subtitle" />
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 bg-accent-500 text-white px-6 py-3 rounded-md font-medium hover:bg-accent-400"
        >
          <T id="hero_cta" />
          <ArrowRight size={18} />
        </Link>
      </div>

      {/* Obvious placeholder — no real banner asset exists yet. Swap this
          block for a real <img>/next/image once you have one; the dashed
          border and icon are deliberate so it never gets mistaken for a
          finished image. */}
      <div className="aspect-video sm:aspect-[4/3] w-full rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-600">
        <ImageIcon size={40} strokeWidth={1.5} />
        <span className="text-sm text-center px-4">
          <T id="hero_image_placeholder" />
        </span>
      </div>
    </section>
  );
}
