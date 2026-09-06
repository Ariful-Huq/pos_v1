import Link from "next/link";
import { ArrowRight, ImageIcon } from "lucide-react";
import T from "./T";

// `banner` is the first row from GET /home-banners/ (already filtered to
// is_active + in-window by the backend — see HomeBannerListView), or null
// if nothing is currently active. Staff add/swap banners for sales, promos,
// festivals, etc. in Django admin — no code change or redeploy needed.
export default function HeroSection({ banner }) {
  const heading = banner?.title || <T id="hero_heading" />;
  const subtitle = banner?.subtitle || <T id="hero_subtitle" />;
  const ctaLabel = banner?.cta_label || <T id="hero_cta" />;
  const ctaHref = banner?.cta_url || "/products";

  if (banner?.image) {
    // Full-width 16:9 banner, copy overlaid on the image's own empty side
    // and anchored to the bottom so it clears whatever's already drawn
    // near the top of the asset (logo, badges, etc.). The copy sits on a
    // photo rather than the page background, so it's deliberately fixed
    // to white/light tones here instead of following light/dark mode —
    // the gradient behind it is what keeps it legible against any image.
    return (
      <section className="relative w-full aspect-video rounded-xl overflow-hidden mb-14">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={banner.image}
          alt={banner.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />

        <div className="relative h-full flex flex-col justify-end px-6 pb-8 pt-6 sm:px-12 sm:pb-12">
          <div className="max-w-md">
            <p className="text-xs font-semibold tracking-wide text-accent-400 uppercase mb-2">
              <T id="hero_eyebrow" />
            </p>
            <h1 className="font-heading text-2xl sm:text-4xl font-bold text-white mb-3">
              {heading}
            </h1>
            <p className="text-gray-200 mb-6">{subtitle}</p>
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 bg-accent-500 text-white px-6 py-3 rounded-md font-medium hover:bg-accent-400"
            >
              {ctaLabel}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // No active banner configured yet — obvious placeholder rather than a
  // fake stock photo. Nothing to overlay copy onto, so this keeps the
  // original side-by-side layout until a real banner is added.
  return (
    <section className="grid sm:grid-cols-2 gap-8 items-center mb-14">
      <div>
        <p className="text-xs font-semibold tracking-wide text-accent-500 uppercase mb-2">
          <T id="hero_eyebrow" />
        </p>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          {heading}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{subtitle}</p>
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 bg-accent-500 text-white px-6 py-3 rounded-md font-medium hover:bg-accent-400"
        >
          {ctaLabel}
          <ArrowRight size={18} />
        </Link>
      </div>

      <div className="aspect-video sm:aspect-[4/3] w-full rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-600">
        <ImageIcon size={40} strokeWidth={1.5} />
        <span className="text-sm text-center px-4">
          <T id="hero_image_placeholder" />
        </span>
      </div>
    </section>
  );
}
