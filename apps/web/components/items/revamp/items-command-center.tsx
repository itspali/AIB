"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, Plus, Settings2 } from "lucide-react";
import { useAppearancePreview } from "@/components/appearance/appearance-preview-provider";
import { Button } from "@/components/ui/button";
import type { ItemsOverviewStats } from "@/lib/items/overview-stats";
import {
  ITEMS_BENTO_TILES,
  ITEMS_JOURNEY,
  type ItemsBentoTile,
  type ItemsJourneyStep,
} from "@/lib/items/overview-workflows";
import { itemCreateHref } from "@/lib/products/item-navigation";
import { cn } from "@/lib/utils";

type Props = {
  stats: ItemsOverviewStats;
};

function useOpenClassicCatalog() {
  const { setGeneration } = useAppearancePreview();
  return () => setGeneration("classic");
}

function JourneyLink({ step }: { step: ItemsJourneyStep }) {
  const openCatalog = useOpenClassicCatalog();

  if (step.openCatalog) {
    return (
      <button type="button" onClick={openCatalog} className="revamp-journey__link group">
        <span className="revamp-journey__node">
          <step.icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="revamp-journey__label">{step.label}</span>
      </button>
    );
  }

  return (
    <Link href={step.href} prefetch className="revamp-journey__link group">
      <span className="revamp-journey__node">
        <step.icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="revamp-journey__label">{step.label}</span>
    </Link>
  );
}

function BentoTileLink({ tile }: { tile: ItemsBentoTile }) {
  const openCatalog = useOpenClassicCatalog();
  const Icon = tile.icon;

  const className = cn(
    "revamp-bento-tile group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    tile.tier === "hero" && "revamp-bento-tile--hero",
    tile.tier === "primary" && "revamp-bento-tile--primary",
    tile.tier === "utility" && "revamp-bento-tile--utility"
  );

  const content = (
    <>
      <span className="revamp-bento-tile__glow" aria-hidden />
      <Icon className="revamp-bento-tile__icon" aria-hidden />
      <span className="revamp-bento-tile__label">{tile.label}</span>
      <ArrowRight
        className="revamp-bento-tile__arrow opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
        aria-hidden
      />
    </>
  );

  if (tile.openCatalog) {
    return (
      <button type="button" onClick={openCatalog} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link href={tile.href} prefetch className={className}>
      {content}
    </Link>
  );
}

function CatalogSignals({ stats }: { stats: ItemsOverviewStats }) {
  const signals = [
    { label: "Total items", value: String(stats.item_count) },
    { label: "Active", value: String(stats.active_item_count) },
    { label: "Categories", value: String(stats.category_count) },
    { label: "Variants", value: String(stats.variant_count) },
  ];

  return (
    <section className="revamp-policy-rail" aria-label="Catalog signals">
      <div className="revamp-policy-rail__head">
        <span className="revamp-kicker">Catalog signals</span>
        <Button variant="ghost" size="sm" className="revamp-policy-rail__manage h-7 px-2 text-xs" asChild>
          <Link href="/settings/uom">
            <Settings2 className="mr-1 h-3.5 w-3.5" aria-hidden />
            UOM settings
          </Link>
        </Button>
      </div>
      <div className="revamp-policy-rail__chips">
        {signals.map((signal) => (
          <div key={signal.label} className="revamp-policy-chip">
            <span className="revamp-policy-chip__label">{signal.label}</span>
            <span className="revamp-policy-chip__value">{signal.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Items module command center — revamp preview landing. */
export function ItemsCommandCenter({ stats }: Props) {
  const router = useRouter();
  const heroTile = ITEMS_BENTO_TILES.find((tile) => tile.tier === "hero");
  const primaryTiles = ITEMS_BENTO_TILES.filter((tile) => tile.tier === "primary");
  const utilityTiles = ITEMS_BENTO_TILES.filter((tile) => tile.tier === "utility");

  return (
    <div className="canvas-scroll-endpad revamp-shell">
      <header className="revamp-hero">
        <div className="revamp-hero__mesh" aria-hidden />
        <div className="revamp-hero__content">
          <div className="revamp-hero__copy">
            <p className="revamp-kicker revamp-kicker--hero">Items</p>
            <h1 className="revamp-hero__title">Product command</h1>
            <p className="revamp-hero__tagline">
              Define sellable and purchasable master data — items, variants, categories, and
              pricing foundations.
            </p>
          </div>
          <div className="revamp-hero__actions">
            <Button
              className="revamp-cta shadow-glow-sm"
              onClick={() => router.push(itemCreateHref())}
              aria-label="New item"
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span className="revamp-cta__label">New item</span>
            </Button>
            <Button variant="outline" size="icon" className="revamp-hero__settings" asChild>
              <Link href="/items/categories" aria-label="Item categories">
                <Settings2 className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <dl className="revamp-stat-rail">
          <div className="revamp-stat">
            <dt className="sr-only">Total items</dt>
            <dd className="revamp-stat__value">{stats.item_count}</dd>
            <dd className="revamp-stat__label">Items</dd>
          </div>
          <div className="revamp-stat-divider" aria-hidden />
          <div className="revamp-stat">
            <dt className="sr-only">Active items</dt>
            <dd className="revamp-stat__value">{stats.active_item_count}</dd>
            <dd className="revamp-stat__label">Active</dd>
          </div>
          <div className="revamp-stat-divider" aria-hidden />
          <div className="revamp-stat">
            <dt className="sr-only">Categories</dt>
            <dd className="revamp-stat__value">{stats.category_count}</dd>
            <dd className="revamp-stat__label">Categories</dd>
          </div>
          <div className="revamp-stat-divider" aria-hidden />
          <div className="revamp-stat">
            <dt className="sr-only">Variants</dt>
            <dd className="revamp-stat__value">{stats.variant_count}</dd>
            <dd className="revamp-stat__label">Variants</dd>
          </div>
        </dl>
      </header>

      <nav className="revamp-journey" aria-label="Items workflow">
        <p className="revamp-kicker">Workflow</p>
        <ol className="revamp-journey__track">
          {ITEMS_JOURNEY.map((step, index) => {
            const isLast = index === ITEMS_JOURNEY.length - 1;
            return (
              <li key={step.id} className="revamp-journey__step">
                <JourneyLink step={step} />
                {!isLast ? (
                  <ChevronRight className="revamp-journey__connector" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="revamp-bento" aria-labelledby="items-revamp-bento-heading">
        <div className="revamp-bento__head">
          <h2 id="items-revamp-bento-heading" className="revamp-section-title">
            Launchpad
          </h2>
          <p className="revamp-section-sub">Jump straight into a workspace.</p>
        </div>
        <div className="revamp-bento__grid">
          {heroTile ? <BentoTileLink tile={heroTile} /> : null}
          {primaryTiles.map((tile) => (
            <BentoTileLink key={tile.id} tile={tile} />
          ))}
          {utilityTiles.length > 0 ? (
            <div className="revamp-bento__utility-row">
              {utilityTiles.map((tile) => (
                <BentoTileLink key={tile.id} tile={tile} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <CatalogSignals stats={stats} />
    </div>
  );
}
