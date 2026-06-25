"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EntityOverviewStats } from "@/lib/entities/types";
import {
  buildProcurementPolicyItems,
  toneBadgeVariant,
  type PolicySnapshot,
} from "@/lib/procurement/policy-summary-items";
import {
  resolveProcurementBentoTiles,
  resolveProcurementJourney,
  type ProcurementBentoTile,
} from "@/lib/procurement/overview-workflows";
import { cn } from "@/lib/utils";

type Props = {
  procurementSettings: PolicySnapshot;
  supplierStats: Pick<EntityOverviewStats, "supplier_count" | "active_supplier_count">;
  importsEnabled?: boolean;
};

function BentoLink({ tile }: { tile: ProcurementBentoTile }) {
  const Icon = tile.icon;

  return (
    <Link
      href={tile.href}
      prefetch
      className={cn(
        "revamp-bento-tile group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tile.tier === "hero" && "revamp-bento-tile--hero",
        tile.tier === "primary" && "revamp-bento-tile--primary",
        tile.tier === "utility" && "revamp-bento-tile--utility"
      )}
    >
      <span className="revamp-bento-tile__glow" aria-hidden />
      <Icon className="revamp-bento-tile__icon" aria-hidden />
      <span className="revamp-bento-tile__label">{tile.label}</span>
      <ArrowRight
        className="revamp-bento-tile__arrow opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  );
}

function PolicyRail({ settings }: { settings: PolicySnapshot }) {
  const [expanded, setExpanded] = useState(false);
  const items = buildProcurementPolicyItems(settings);
  const visible = expanded ? items : items.slice(0, 4);

  return (
    <section className="revamp-policy-rail" aria-label="Active procurement policies">
      <div className="revamp-policy-rail__head">
        <span className="revamp-kicker">Governance</span>
        <Button variant="ghost" size="sm" className="revamp-policy-rail__manage h-7 px-2 text-xs" asChild>
          <Link href="/settings/modules/procurement?tab=policies">
            <Settings2 className="mr-1 h-3.5 w-3.5" aria-hidden />
            Policies
          </Link>
        </Button>
      </div>
      <div className="revamp-policy-rail__chips">
        {visible.map((item) => (
          <div key={item.label} className="revamp-policy-chip">
            <span className="revamp-policy-chip__label">{item.label}</span>
            {item.tone ? (
              <Badge variant={toneBadgeVariant(item.tone)} className="h-5 px-1.5 text-[10px]">
                {item.value}
              </Badge>
            ) : (
              <span className="revamp-policy-chip__value">{item.value}</span>
            )}
          </div>
        ))}
        {items.length > 4 ? (
          <button
            type="button"
            className="revamp-policy-chip revamp-policy-chip--toggle"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Show less" : `+${items.length - 4} more`}
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** Fully rethought procurement module landing — command center layout. */
export function ProcurementCommandCenter({
  procurementSettings,
  supplierStats,
  importsEnabled = false,
}: Props) {
  const journey = resolveProcurementJourney(importsEnabled);
  const bentoTiles = resolveProcurementBentoTiles(importsEnabled);
  const heroTile = bentoTiles.find((tile) => tile.tier === "hero");
  const primaryTiles = bentoTiles.filter((tile) => tile.tier === "primary");
  const utilityTiles = bentoTiles.filter((tile) => tile.tier === "utility");

  return (
    <div className="canvas-scroll-endpad revamp-shell">
      <header className="revamp-hero">
        <div className="revamp-hero__mesh" aria-hidden />
        <div className="revamp-hero__content">
          <div className="revamp-hero__copy">
            <p className="revamp-kicker revamp-kicker--hero">Procurement</p>
            <h1 className="revamp-hero__title">Inbound command</h1>
            <p className="revamp-hero__tagline">
              Order, receive, and reconcile supplier flow in one workspace.
            </p>
          </div>
          <div className="revamp-hero__actions">
            <Button className="revamp-cta shadow-glow-sm" asChild>
              <Link href="/procurement/purchase-orders?action=new">
                <Plus className="h-4 w-4" aria-hidden />
                <span className="revamp-cta__label">New purchase order</span>
                <span className="sr-only sm:hidden">New purchase order</span>
              </Link>
            </Button>
            <Button variant="outline" size="icon" className="revamp-hero__settings" asChild>
              <Link href="/settings/modules/procurement" aria-label="Procurement module settings">
                <Settings2 className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <dl className="revamp-stat-rail">
          <div className="revamp-stat">
            <dt className="sr-only">Total suppliers</dt>
            <dd className="revamp-stat__value">{supplierStats.supplier_count}</dd>
            <dd className="revamp-stat__label">Suppliers</dd>
          </div>
          <div className="revamp-stat-divider" aria-hidden />
          <div className="revamp-stat">
            <dt className="sr-only">Active suppliers</dt>
            <dd className="revamp-stat__value">{supplierStats.active_supplier_count}</dd>
            <dd className="revamp-stat__label">Active</dd>
          </div>
          <div className="revamp-stat-divider" aria-hidden />
          <div className="revamp-stat">
            <dt className="sr-only">Workflow stages</dt>
            <dd className="revamp-stat__value">{journey.length}</dd>
            <dd className="revamp-stat__label">Flow steps</dd>
          </div>
        </dl>
      </header>

      <nav className="revamp-journey" aria-label="Procurement workflow">
        <p className="revamp-kicker">Workflow</p>
        <ol className="revamp-journey__track">
          {journey.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === journey.length - 1;
            return (
              <li key={step.id} className="revamp-journey__step">
                <Link href={step.href} prefetch className="revamp-journey__link group">
                  <span className="revamp-journey__node">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="revamp-journey__label">{step.label}</span>
                </Link>
                {!isLast ? (
                  <ChevronRight className="revamp-journey__connector" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="revamp-bento" aria-labelledby="revamp-bento-heading">
        <div className="revamp-bento__head">
          <h2 id="revamp-bento-heading" className="revamp-section-title">
            Launchpad
          </h2>
          <p className="revamp-section-sub">Jump straight into a workspace.</p>
        </div>
        <div className="revamp-bento__grid">
          {heroTile ? <BentoLink tile={heroTile} /> : null}
          {primaryTiles.map((tile) => (
            <BentoLink key={tile.id} tile={tile} />
          ))}
          {utilityTiles.length > 0 ? (
            <div className="revamp-bento__utility-row">
              {utilityTiles.map((tile) => (
                <BentoLink key={tile.id} tile={tile} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <PolicyRail settings={procurementSettings} />
    </div>
  );
}
