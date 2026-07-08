const R = 42;
const LEFT = 108;
const RIGHT = 992;
const TOP = 156;
const BOTTOM = 304;

const MAIN_LOOP = [
  `M ${LEFT + R} ${TOP}`,
  `L ${RIGHT - R} ${TOP}`,
  `A ${R} ${R} 0 0 1 ${RIGHT} ${TOP + R}`,
  `L ${RIGHT} ${BOTTOM - R}`,
  `A ${R} ${R} 0 0 1 ${RIGHT - R} ${BOTTOM}`,
  `L ${LEFT + R} ${BOTTOM}`,
  `A ${R} ${R} 0 0 1 ${LEFT} ${BOTTOM - R}`,
  `L ${LEFT} ${TOP + R}`,
  `A ${R} ${R} 0 0 1 ${LEFT + R} ${TOP}`,
].join(" ");

const ORDER_MERGE_PATHS = {
  web: `M 328 96 L 328 136 Q 328 146 338 146 L 358 146 L 358 ${TOP}`,
  mobile: `M 384 78 L 384 ${TOP}`,
  pos: `M 440 96 L 440 136 Q 440 146 430 146 L 410 146 L 410 ${TOP}`,
} as const;

const PROCUREMENT_MERGE_PATHS = {
  vendor: `M 318 336 L 318 316 Q 318 306 328 306 L 358 306 L 358 ${BOTTOM}`,
  purchaseOrder: `M 418 336 L 418 314 L 398 314 L 398 ${BOTTOM}`,
} as const;

const FULFILLMENT_SPLIT_PATHS = {
  parcel: `M 612 ${TOP} L 612 124 Q 612 114 602 114 L 588 114 L 588 96`,
  carrier: `M 636 ${TOP} L 636 124 Q 636 114 646 114 L 660 114 L 660 96`,
} as const;

const ALL_RAILS = [
  MAIN_LOOP,
  ...Object.values(ORDER_MERGE_PATHS),
  ...Object.values(PROCUREMENT_MERGE_PATHS),
  ...Object.values(FULFILLMENT_SPLIT_PATHS),
];

const ink = "hsl(var(--primary))";
const inkSoft = (o: number) => ({ stroke: ink, strokeOpacity: o });
const fillSoft = (o: number) => ({ fill: ink, fillOpacity: o });

type FlowLightProps = { path: string; dur: string; begin?: string; size?: number; blurId: string };

function FlowLight({ path, dur, begin, size = 3, blurId }: FlowLightProps) {
  return (
    <g filter={`url(#${blurId})`} className="auth-flow-orb">
      <circle r={size + 4} className="fill-primary/18">
        <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={path} calcMode="linear" keyPoints="0;1" keyTimes="0;1" />
      </circle>
      <circle r={size} className="fill-primary/82">
        <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={path} calcMode="linear" keyPoints="0;1" keyTimes="0;1" />
      </circle>
    </g>
  );
}

function FlowRail({ d, width = 1.2 }: { d: string; width?: number }) {
  return (
    <path d={d} stroke={ink} strokeOpacity={0.14} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
  );
}

type ShadowKind = "point" | "document" | "shelf" | "vehicle" | "chart";

function AssetShadow({ kind, cx, cy }: { kind: ShadowKind; cx: number; cy: number }) {
  const base = { fill: "hsl(var(--foreground))" };
  switch (kind) {
    case "point":
      return <ellipse cx={cx} cy={cy + 1} rx={11} ry={3} {...base} fillOpacity={0.045} />;
    case "document":
      return <ellipse cx={cx + 1} cy={cy + 2} rx={20} ry={5} {...base} fillOpacity={0.05} />;
    case "shelf":
      return <ellipse cx={cx} cy={cy + 3} rx={40} ry={9} {...base} fillOpacity={0.055} />;
    case "vehicle":
      return <ellipse cx={cx} cy={cy + 2} rx={38} ry={7} {...base} fillOpacity={0.05} />;
    case "chart":
      return <ellipse cx={cx} cy={cy + 2} rx={34} ry={7} {...base} fillOpacity={0.045} />;
  }
}

function WebMonitorIcon() {
  return (
    <g>
      <rect x={312} y={76} width={40} height={28} rx={3} fill="hsl(var(--card))" fillOpacity={0.9} {...inkSoft(0.21)} strokeWidth={1.2} />
      <rect x={316} y={80} width={32} height={18} rx={1} {...fillSoft(0.06)} />
      <line x1={322} y1={86} x2={342} y2={86} {...inkSoft(0.14)} strokeWidth={1} />
      <line x1={322} y1={92} x2={336} y2={92} {...inkSoft(0.1)} strokeWidth={1} />
      <path d="M 324 104 L 340 104 L 332 110 Z" {...inkSoft(0.14)} strokeWidth={1.1} fill="hsl(var(--card))" fillOpacity={0.85} />
      <line x1={332} y1={104} x2={332} y2={110} {...inkSoft(0.12)} strokeWidth={1} />
    </g>
  );
}

function MobilePhoneIcon() {
  return (
    <g>
      <rect x={376} y={62} width={22} height={38} rx={5} fill="hsl(var(--card))" fillOpacity={0.9} {...inkSoft(0.21)} strokeWidth={1.2} />
      <rect x={380} y={70} width={14} height={22} rx={1} {...fillSoft(0.05)} />
      <circle cx={387} cy={96} r={1.5} {...fillSoft(0.2)} stroke="none" />
      <line x1={381} y1={66} x2={393} y2={66} {...inkSoft(0.12)} strokeWidth={1} />
    </g>
  );
}

function PosTerminalIcon() {
  return (
    <g>
      <path d="M 420 88 L 454 88 L 458 100 L 416 100 Z" fill="hsl(var(--card))" fillOpacity={0.9} {...inkSoft(0.21)} strokeWidth={1.2} />
      <rect x={424} y={96} width={26} height={14} rx={2} {...fillSoft(0.06)} {...inkSoft(0.14)} strokeWidth={1} />
      <rect x={430} y={100} width={14} height={6} rx={1} {...fillSoft(0.1)} />
      <line x1={438} y1={110} x2={438} y2={114} {...inkSoft(0.12)} strokeWidth={1.2} />
      <line x1={432} y1={114} x2={444} y2={114} {...inkSoft(0.12)} strokeWidth={1.2} />
    </g>
  );
}

function ParcelIcon() {
  return (
    <g>
      <rect x={578} y={74} width={26} height={22} rx={2} fill="hsl(var(--card))" fillOpacity={0.88} {...inkSoft(0.2)} strokeWidth={1.1} />
      <path d="M 578 80 L 591 74 L 604 80" {...inkSoft(0.15)} strokeWidth={1} fill="none" />
      <line x1={591} y1={74} x2={591} y2={96} {...inkSoft(0.14)} strokeWidth={1} />
      <line x1={584} y1={88} x2={598} y2={88} {...inkSoft(0.12)} strokeWidth={1} />
    </g>
  );
}

function CarrierVanIcon() {
  return (
    <g>
      <rect x={644} y={80} width={30} height={16} rx={2} fill="hsl(var(--card))" fillOpacity={0.88} {...inkSoft(0.2)} strokeWidth={1.1} />
      <path d="M 636 88 H 644" {...inkSoft(0.15)} strokeWidth={1.2} />
      <rect x={638} y={82} width={8} height={10} rx={1} {...fillSoft(0.05)} {...inkSoft(0.12)} strokeWidth={0.9} />
      <circle cx={652} cy={98} r={4} fill="none" {...inkSoft(0.19)} strokeWidth={1} />
      <circle cx={668} cy={98} r={4} fill="none" {...inkSoft(0.19)} strokeWidth={1} />
    </g>
  );
}

function VendorTruckIcon() {
  return (
    <g>
      <rect x={298} y={324} width={28} height={14} rx={2} fill="hsl(var(--card))" fillOpacity={0.88} {...inkSoft(0.19)} strokeWidth={1.1} />
      <rect x={290} y={328} width={10} height={10} rx={1} {...fillSoft(0.06)} {...inkSoft(0.14)} strokeWidth={0.9} />
      <circle cx={304} cy={340} r={3.5} fill="none" {...inkSoft(0.14)} strokeWidth={1} />
      <circle cx={320} cy={340} r={3.5} fill="none" {...inkSoft(0.14)} strokeWidth={1} />
      <path d="M 330 330 H 338 V 322 H 334 Z" {...fillSoft(0.08)} {...inkSoft(0.12)} strokeWidth={0.9} />
    </g>
  );
}

function PurchaseOrderIcon({ frontGrad }: { frontGrad: string }) {
  return (
    <g>
      <path d="M 408 320 L 440 320 L 440 352 L 408 352 Z" fill={`url(#${frontGrad})`} {...inkSoft(0.19)} strokeWidth={1.1} />
      <path d="M 428 320 L 440 320 L 440 332 L 428 332 Z" fill="hsl(var(--card))" fillOpacity={0.7} {...inkSoft(0.12)} strokeWidth={0.9} />
      <line x1={414} y1={330} x2={432} y2={330} {...inkSoft(0.12)} strokeWidth={1} />
      <line x1={414} y1={338} x2={428} y2={338} {...inkSoft(0.1)} strokeWidth={1} />
      <path d="M 416 346 L 430 346" {...inkSoft(0.14)} strokeWidth={1.2} />
    </g>
  );
}

function WarehouseInventoryIcon({ boxTop, boxFront, boxSide }: { boxTop: string; boxFront: string; boxSide: string }) {
  return (
    <g>
      <line x1={128} y1={248} x2={200} y2={248} {...inkSoft(0.17)} strokeWidth={1.3} />
      <line x1={136} y1={210} x2={136} y2={248} {...inkSoft(0.17)} strokeWidth={1.3} />
      <line x1={192} y1={210} x2={192} y2={248} {...inkSoft(0.17)} strokeWidth={1.3} />
      <line x1={128} y1={210} x2={200} y2={210} {...inkSoft(0.17)} strokeWidth={1.3} />
      <PalletBox x={144} y={216} w={22} h={16} d={5} fills={{ top: boxTop, front: boxFront, side: boxSide }} />
      <PalletBox x={166} y={220} w={18} h={12} d={4} fills={{ top: boxTop, front: boxFront, side: boxSide }} />
      <PalletBox x={152} y={198} w={20} h={14} d={5} fills={{ top: boxTop, front: boxFront, side: boxSide }} />
    </g>
  );
}

function PalletBox({
  x,
  y,
  w,
  h,
  d,
  fills,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
  fills: { top: string; front: string; side: string };
}) {
  const ox = d * 0.5;
  const oy = d * 0.3;
  const s = { stroke: ink, strokeOpacity: 0.17, strokeWidth: 1 };
  return (
    <g>
      <polygon points={`${x + w},${y} ${x + w + ox},${y - oy} ${x + w + ox},${y + h - oy} ${x + w},${y + h}`} fill={`url(#${fills.side})`} {...s} />
      <polygon points={`${x},${y} ${x + w},${y} ${x + w + ox},${y - oy} ${x + ox},${y - oy}`} fill={`url(#${fills.top})`} {...s} />
      <rect x={x} y={y} width={w} height={h} rx={1} fill={`url(#${fills.front})`} {...s} />
    </g>
  );
}

function OrderClipboardIcon({ frontGrad }: { frontGrad: string }) {
  return (
    <g>
      <rect x={362} y={178} width={8} height={18} rx={2} {...fillSoft(0.1)} {...inkSoft(0.14)} strokeWidth={1} />
      <rect x={358} y={192} width={16} height={6} rx={3} {...fillSoft(0.12)} {...inkSoft(0.14)} strokeWidth={1} />
      <rect x={352} y={198} width={64} height={72} rx={4} fill={`url(#${frontGrad})`} {...inkSoft(0.2)} strokeWidth={1.2} />
      <rect x={360} y={208} width={10} height={10} rx={2} {...inkSoft(0.14)} strokeWidth={1} />
      <path d="M 362 214 L 368 218 L 362 222 Z" {...fillSoft(0.15)} />
      <line x1={374} y1={212} x2={404} y2={212} {...inkSoft(0.13)} strokeWidth={1.1} />
      <rect x={360} y={224} width={10} height={10} rx={2} {...inkSoft(0.12)} strokeWidth={1} />
      <path d="M 363 230 L 367 230 L 365 234 Z" {...fillSoft(0.12)} />
      <line x1={374} y1={228} x2={398} y2={228} {...inkSoft(0.11)} strokeWidth={1.1} />
      <line x1={374} y1={244} x2={406} y2={244} {...inkSoft(0.1)} strokeWidth={1.1} />
      <rect x={374} y={256} width={32} height={10} rx={2} {...fillSoft(0.08)} />
    </g>
  );
}

function FulfillmentTruckIcon({ frontGrad }: { frontGrad: string }) {
  return (
    <g>
      <rect x={588} y={200} width={48} height={26} rx={3} fill={`url(#${frontGrad})`} {...inkSoft(0.2)} strokeWidth={1.2} />
      <path d="M 636 200 H 656 L 668 218 H 668 226 H 588" {...inkSoft(0.2)} strokeWidth={1.2} fill="hsl(var(--card))" fillOpacity={0.85} />
      <rect x={642} y={206} width={10} height={10} rx={1} {...fillSoft(0.06)} {...inkSoft(0.12)} strokeWidth={0.9} />
      <circle cx={604} cy={228} r={9} fill="hsl(var(--card))" fillOpacity={0.9} {...inkSoft(0.15)} strokeWidth={1.1} />
      <circle cx={652} cy={228} r={9} fill="hsl(var(--card))" fillOpacity={0.9} {...inkSoft(0.15)} strokeWidth={1.1} />
      <rect x={596} y={208} width={20} height={12} rx={1} {...fillSoft(0.05)} {...inkSoft(0.1)} strokeWidth={0.9} />
    </g>
  );
}

function InsightsChartIcon() {
  return (
    <g>
      <line x1={838} y1={272} x2={948} y2={272} {...inkSoft(0.1)} strokeWidth={1.1} />
      <rect x={848} y={248} width={12} height={24} rx={1} {...fillSoft(0.1)} {...inkSoft(0.14)} strokeWidth={1} />
      <rect x={866} y={232} width={12} height={40} rx={1} {...fillSoft(0.13)} {...inkSoft(0.15)} strokeWidth={1} />
      <rect x={884} y={256} width={12} height={16} rx={1} {...fillSoft(0.08)} {...inkSoft(0.13)} strokeWidth={1} />
      <rect x={902} y={240} width={12} height={32} rx={1} {...fillSoft(0.11)} {...inkSoft(0.14)} strokeWidth={1} />
      <path
        d="M 844 220 L 868 206 L 892 214 L 916 196 L 944 204"
        stroke="hsl(var(--accent))"
        strokeOpacity={0.28}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx={868} cy={206} r={2} fill="hsl(var(--accent))" fillOpacity={0.35} />
      <circle cx={916} cy={196} r={2} fill="hsl(var(--accent))" fillOpacity={0.35} />
    </g>
  );
}

function DemandForecastIcon({ frontGrad }: { frontGrad: string }) {
  return (
    <g>
      <rect x={756} y={284} width={56} height={38} rx={5} fill={`url(#${frontGrad})`} {...inkSoft(0.19)} strokeWidth={1.1} />
      <path
        d="M 766 310 L 778 300 L 790 306 L 802 292 L 814 298 L 802 314 Z"
        {...fillSoft(0.07)}
        {...inkSoft(0.12)}
        strokeWidth={1}
      />
      <path
        d="M 766 310 L 778 300 L 790 306 L 802 292 L 814 298"
        stroke="hsl(var(--accent))"
        strokeOpacity={0.3}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <line x1={764} y1={316} x2={808} y2={316} {...inkSoft(0.08)} strokeWidth={1} strokeDasharray="2 3" />
    </g>
  );
}

function ProcurementHubIcon({ frontGrad, boxFront }: { frontGrad: string; boxFront: string }) {
  return (
    <g>
      <rect x={356} y={284} width={56} height={38} rx={5} fill={`url(#${frontGrad})`} {...inkSoft(0.19)} strokeWidth={1.1} />
      <path d="M 368 302 H 388 M 378 294 V 310" {...inkSoft(0.14)} strokeWidth={1.2} strokeLinecap="round" />
      <path d="M 394 308 L 404 302 L 414 308 L 404 314 Z" {...fillSoft(0.1)} {...inkSoft(0.14)} strokeWidth={1} />
      <rect x={396} y={300} width={16} height={12} rx={1} fill={`url(#${boxFront})`} {...inkSoft(0.13)} strokeWidth={0.9} />
      <path d="M 398 306 H 410 M 404 302 V 310" {...inkSoft(0.1)} strokeWidth={0.9} strokeLinecap="round" />
      <path d="M 418 306 H 432 L 436 300 H 422 Z" {...fillSoft(0.08)} {...inkSoft(0.12)} strokeWidth={0.9} />
    </g>
  );
}

type CommerceAuthIllustrationProps = { className?: string; gradientId?: string };

export function CommerceAuthIllustration({ className, gradientId = "auth-flow" }: CommerceAuthIllustrationProps) {
  const blurId = `${gradientId}-blur`;
  const frontGrad = `${gradientId}-front`;
  const boxTop = `${gradientId}-box-top`;
  const boxFront = `${gradientId}-box-front`;
  const boxSide = `${gradientId}-box-side`;
  const shDoc = `${gradientId}-sh-doc`;
  const shShelf = `${gradientId}-sh-shelf`;
  const shVehicle = `${gradientId}-sh-vehicle`;
  const shChart = `${gradientId}-sh-chart`;
  const shPoint = `${gradientId}-sh-point`;

  return (
    <svg
      className={className}
      viewBox="70 55 940 295"
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={frontGrad} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="0.88" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={boxTop} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.14" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.07" />
        </linearGradient>
        <linearGradient id={boxFront} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="0.85" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id={boxSide} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.06" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.14" />
        </linearGradient>
        <filter id={blurId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={shPoint} x="-80%" y="-60%" width="260%" height="220%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="hsl(var(--foreground))" floodOpacity="0.06" />
        </filter>
        <filter id={shDoc} x="-50%" y="-40%" width="200%" height="200%">
          <feDropShadow dx="1" dy="3" stdDeviation="2.5" floodColor="hsl(var(--foreground))" floodOpacity="0.07" />
        </filter>
        <filter id={shShelf} x="-45%" y="-30%" width="190%" height="180%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="hsl(var(--foreground))" floodOpacity="0.08" />
        </filter>
        <filter id={shVehicle} x="-50%" y="-35%" width="200%" height="190%">
          <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="hsl(var(--foreground))" floodOpacity="0.075" />
        </filter>
        <filter id={shChart} x="-45%" y="-35%" width="190%" height="190%">
          <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="hsl(var(--accent))" floodOpacity="0.06" />
        </filter>
      </defs>

      <FlowRail d={MAIN_LOOP} width={1.35} />
      {ALL_RAILS.slice(1).map((d) => (
        <FlowRail key={d} d={d} width={1.1} />
      ))}

      {/* Ground shadows — shape matches asset type */}
      <AssetShadow kind="point" cx={332} cy={110} />
      <AssetShadow kind="point" cx={387} cy={106} />
      <AssetShadow kind="point" cx={436} cy={110} />
      <AssetShadow kind="document" cx={591} cy={100} />
      <AssetShadow kind="vehicle" cx={662} cy={104} />
      <AssetShadow kind="vehicle" cx={314} cy={348} />
      <AssetShadow kind="document" cx={424} cy={352} />
      <AssetShadow kind="shelf" cx={164} cy={254} />
      <AssetShadow kind="document" cx={388} cy={276} />
      <AssetShadow kind="vehicle" cx={628} cy={234} />
      <AssetShadow kind="chart" cx={884} cy={278} />
      <AssetShadow kind="chart" cx={784} cy={328} />
      <AssetShadow kind="document" cx={388} cy={328} />

      <FlowLight path={MAIN_LOOP} dur="18s" size={3.5} blurId={blurId} />
      <FlowLight path={ORDER_MERGE_PATHS.web} dur="3.2s" blurId={blurId} />
      <FlowLight path={ORDER_MERGE_PATHS.mobile} dur="2.8s" begin="0.9s" blurId={blurId} />
      <FlowLight path={ORDER_MERGE_PATHS.pos} dur="3.4s" begin="1.7s" blurId={blurId} />
      <FlowLight path={PROCUREMENT_MERGE_PATHS.vendor} dur="3.6s" begin="0.4s" blurId={blurId} />
      <FlowLight path={PROCUREMENT_MERGE_PATHS.purchaseOrder} dur="3s" begin="1.3s" blurId={blurId} />
      <FlowLight path={FULFILLMENT_SPLIT_PATHS.parcel} dur="2.6s" begin="0.2s" blurId={blurId} />
      <FlowLight path={FULFILLMENT_SPLIT_PATHS.carrier} dur="2.6s" begin="1.1s" blurId={blurId} />

      <g filter={`url(#${shPoint})`}>
        <WebMonitorIcon />
        <MobilePhoneIcon />
        <PosTerminalIcon />
      </g>

      <g filter={`url(#${shDoc})`}>
        <ParcelIcon />
      </g>
      <g filter={`url(#${shVehicle})`}>
        <CarrierVanIcon />
      </g>

      <g filter={`url(#${shVehicle})`}>
        <VendorTruckIcon />
      </g>
      <g filter={`url(#${shDoc})`}>
        <PurchaseOrderIcon frontGrad={frontGrad} />
      </g>

      <g filter={`url(#${shShelf})`}>
        <WarehouseInventoryIcon boxTop={boxTop} boxFront={boxFront} boxSide={boxSide} />
      </g>

      <g filter={`url(#${shDoc})`}>
        <OrderClipboardIcon frontGrad={frontGrad} />
      </g>

      <g filter={`url(#${shVehicle})`}>
        <FulfillmentTruckIcon frontGrad={frontGrad} />
      </g>

      <g filter={`url(#${shChart})`}>
        <InsightsChartIcon />
      </g>

      <g filter={`url(#${shChart})`}>
        <DemandForecastIcon frontGrad={frontGrad} />
      </g>

      <g filter={`url(#${shDoc})`}>
        <ProcurementHubIcon frontGrad={frontGrad} boxFront={boxFront} />
      </g>

      <text x={164} y={148} textAnchor="middle" className="fill-muted-foreground/42 text-[12px] font-medium">
        Inventory
      </text>
      <text x={388} y={148} textAnchor="middle" className="fill-muted-foreground/42 text-[12px] font-medium">
        Orders
      </text>
      <text x={624} y={148} textAnchor="middle" className="fill-muted-foreground/42 text-[12px] font-medium">
        Fulfillment
      </text>
      <text x={884} y={148} textAnchor="middle" className="fill-muted-foreground/42 text-[12px] font-medium">
        Insights
      </text>
      <text x={388} y={338} textAnchor="middle" className="fill-muted-foreground/42 text-[12px] font-medium">
        Procurement
      </text>
      <text x={784} y={338} textAnchor="middle" className="fill-muted-foreground/42 text-[12px] font-medium">
        Demand
      </text>

      <g className="max-sm:hidden">
        {[
          [332, 112, "Web"],
          [387, 112, "Mobile"],
          [436, 112, "POS"],
          [591, 112, "Parcel"],
          [662, 112, "Carrier"],
          [314, 358, "Vendor"],
          [424, 358, "PO"],
        ].map(([x, y, label]) => (
          <text key={label as string} x={x as number} y={y as number} textAnchor="middle" className="fill-muted-foreground/34 text-[10px]">
            {label as string}
          </text>
        ))}
      </g>
    </svg>
  );
}
