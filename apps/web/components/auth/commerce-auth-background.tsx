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

type FlowLightProps = {
  path: string;
  dur: string;
  begin?: string;
  size?: number;
  blurId: string;
};

function FlowLight({ path, dur, begin, size = 3.5, blurId }: FlowLightProps) {
  return (
    <g filter={`url(#${blurId})`} className="auth-flow-orb">
      <circle r={size + 6} className="fill-primary/25">
        <animateMotion
          dur={dur}
          begin={begin}
          repeatCount="indefinite"
          path={path}
          calcMode="linear"
          keyPoints="0;1"
          keyTimes="0;1"
        />
      </circle>
      <circle r={size} className="fill-primary">
        <animateMotion
          dur={dur}
          begin={begin}
          repeatCount="indefinite"
          path={path}
          calcMode="linear"
          keyPoints="0;1"
          keyTimes="0;1"
        />
      </circle>
    </g>
  );
}

function FlowRail({ d, width = 1.25 }: { d: string; width?: number }) {
  return (
    <g>
      <path
        d={d}
        stroke="hsl(var(--primary))"
        strokeOpacity="0.07"
        strokeWidth={width + 5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        stroke="hsl(var(--primary))"
        strokeOpacity="0.13"
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function PlatformShadow({ cx, cy, rx = 34, ry = 10 }: { cx: number; cy: number; rx?: number; ry?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="hsl(var(--primary))" fillOpacity="0.06" />;
}

type IsoBoxProps = {
  x: number;
  y: number;
  w: number;
  h: number;
  d?: number;
  topFill: string;
  frontFill: string;
  sideFill: string;
  stroke?: string;
  strokeOpacity?: number;
};

function IsoBox({
  x,
  y,
  w,
  h,
  d = 9,
  topFill,
  frontFill,
  sideFill,
  stroke = "hsl(var(--primary))",
  strokeOpacity = 0.22,
}: IsoBoxProps) {
  const ox = d * 0.55;
  const oy = d * 0.32;
  const strokeProps = {
    stroke,
    strokeOpacity,
    strokeWidth: 1.15,
    strokeLinejoin: "round" as const,
  };

  return (
    <g>
      <polygon
        points={`${x + w},${y} ${x + w + ox},${y - oy} ${x + w + ox},${y + h - oy} ${x + w},${y + h}`}
        fill={sideFill}
        {...strokeProps}
      />
      <polygon
        points={`${x},${y} ${x + w},${y} ${x + w + ox},${y - oy} ${x + ox},${y - oy}`}
        fill={topFill}
        {...strokeProps}
      />
      <rect x={x} y={y} width={w} height={h} rx={3} fill={frontFill} {...strokeProps} />
    </g>
  );
}

type Card3DProps = {
  x: number;
  y: number;
  w: number;
  h: number;
  ids: { top: string; front: string; side: string };
};

function Card3D({ x, y, w, h, ids }: Card3DProps) {
  const d = 8;
  const ox = d * 0.5;
  const oy = d * 0.28;
  return (
    <g filter={`url(#${ids.front}-shadow)`}>
      <polygon
        points={`${x + w},${y} ${x + w + ox},${y - oy} ${x + w + ox},${y + h - oy} ${x + w},${y + h}`}
        fill={`url(#${ids.side})`}
        stroke="hsl(var(--primary))"
        strokeOpacity="0.2"
        strokeWidth="1"
      />
      <polygon
        points={`${x},${y} ${x + w},${y} ${x + w + ox},${y - oy} ${x + ox},${y - oy}`}
        fill={`url(#${ids.top})`}
        stroke="hsl(var(--primary))"
        strokeOpacity="0.22"
        strokeWidth="1"
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={5}
        fill={`url(#${ids.front})`}
        stroke="hsl(var(--primary))"
        strokeOpacity="0.28"
        strokeWidth="1.2"
      />
    </g>
  );
}

type CommerceAuthIllustrationProps = {
  className?: string;
  gradientId?: string;
};

export function CommerceAuthIllustration({
  className,
  gradientId = "auth-flow",
}: CommerceAuthIllustrationProps) {
  const blurId = `${gradientId}-blur`;
  const topGrad = `${gradientId}-top`;
  const frontGrad = `${gradientId}-front`;
  const sideGrad = `${gradientId}-side`;
  const boxTop = `${gradientId}-box-top`;
  const boxFront = `${gradientId}-box-front`;
  const boxSide = `${gradientId}-box-side`;

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
        <linearGradient id={topGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id={frontGrad} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="0.95" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={sideGrad} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.14" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id={boxTop} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id={boxFront} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.16" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id={boxSide} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
        </linearGradient>
        <filter id={blurId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${frontGrad}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="hsl(var(--primary))" floodOpacity="0.12" />
        </filter>
        <filter id={`${gradientId}-node-shadow`} x="-40%" y="-20%" width="180%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="hsl(var(--foreground))" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* Flow rails — soft luminous track */}
      <FlowRail d={MAIN_LOOP} width={1.5} />
      {ALL_RAILS.slice(1).map((d) => (
        <FlowRail key={d} d={d} width={1.15} />
      ))}

      {/* Lights */}
      <FlowLight path={MAIN_LOOP} dur="18s" size={4.5} blurId={blurId} />
      <FlowLight path={ORDER_MERGE_PATHS.web} dur="3.2s" begin="0s" blurId={blurId} />
      <FlowLight path={ORDER_MERGE_PATHS.mobile} dur="2.8s" begin="0.9s" blurId={blurId} />
      <FlowLight path={ORDER_MERGE_PATHS.pos} dur="3.4s" begin="1.7s" blurId={blurId} />
      <FlowLight path={PROCUREMENT_MERGE_PATHS.vendor} dur="3.6s" begin="0.4s" blurId={blurId} />
      <FlowLight path={PROCUREMENT_MERGE_PATHS.purchaseOrder} dur="3s" begin="1.3s" blurId={blurId} />
      <FlowLight path={FULFILLMENT_SPLIT_PATHS.parcel} dur="2.6s" begin="0.2s" blurId={blurId} />
      <FlowLight path={FULFILLMENT_SPLIT_PATHS.carrier} dur="2.6s" begin="1.1s" blurId={blurId} />

      {/* ── Order channels (mini 3D) ── */}
      <g filter={`url(#${gradientId}-node-shadow)`}>
        <PlatformShadow cx={328} cy={108} rx={24} ry={7} />
        <IsoBox x={310} y={78} w={36} h={24} d={6} topFill={`url(#${boxTop})`} frontFill={`url(#${boxFront})`} sideFill={`url(#${boxSide})`} />
        <PlatformShadow cx={384} cy={104} rx={16} ry={6} />
        <IsoBox x={374} y={64} w={20} h={34} d={5} topFill={`url(#${boxTop})`} frontFill={`url(#${boxFront})`} sideFill={`url(#${boxSide})`} stroke="hsl(var(--primary))" strokeOpacity={0.22} />
        <PlatformShadow cx={436} cy={108} rx={22} ry={7} />
        <IsoBox x={420} y={84} w={32} h={18} d={5} topFill={`url(#${boxTop})`} frontFill={`url(#${boxFront})`} sideFill={`url(#${boxSide})`} stroke="hsl(var(--primary))" strokeOpacity={0.22} />
      </g>

      {/* ── Fulfillment channels ── */}
      <g filter={`url(#${gradientId}-node-shadow)`}>
        <PlatformShadow cx={588} cy={104} rx={20} ry={6} />
        <IsoBox x={576} y={76} w={24} h={20} d={5} topFill={`url(#${boxTop})`} frontFill={`url(#${boxFront})`} sideFill={`url(#${boxSide})`} stroke="hsl(var(--primary))" strokeOpacity={0.22} />
        <PlatformShadow cx={662} cy={108} rx={22} ry={7} />
        <rect x={648} y={82} width={28} height={16} rx={3} fill={`url(#${boxFront})`} stroke="hsl(var(--primary))" strokeOpacity={0.22} />
        <circle cx={656} cy={104} r={4} fill="none" stroke="hsl(var(--primary))" strokeOpacity={0.3} />
        <circle cx={668} cy={104} r={4} fill="none" stroke="hsl(var(--primary))" strokeOpacity={0.3} />
      </g>

      {/* ── Procurement sources ── */}
      <g filter={`url(#${gradientId}-node-shadow)`}>
        <PlatformShadow cx={318} cy={348} rx={24} ry={7} />
        <IsoBox x={300} y={322} w={36} h={22} d={5} topFill={`url(#${boxTop})`} frontFill={`url(#${boxFront})`} sideFill={`url(#${boxSide})`} stroke="hsl(var(--primary))" strokeOpacity={0.22} />
        <PlatformShadow cx={422} cy={352} rx={22} ry={7} />
        <Card3D x={406} y={318} w={32} h={30} ids={{ top: topGrad, front: frontGrad, side: sideGrad }} />
      </g>

      {/* ── Inventory ── */}
      <g filter={`url(#${gradientId}-node-shadow)`}>
        <PlatformShadow cx={168} cy={268} rx={38} ry={11} />
        <IsoBox x={148} y={188} w={40} h={28} d={8} topFill={`url(#${boxTop})`} frontFill={`url(#${boxFront})`} sideFill={`url(#${boxSide})`} stroke="hsl(var(--primary))" strokeOpacity={0.25} />
        <IsoBox x={158} y={222} w={36} h={26} d={7} topFill={`url(#${boxTop})`} frontFill={`url(#${boxFront})`} sideFill={`url(#${boxSide})`} stroke="hsl(var(--primary))" strokeOpacity={0.22} />
        <IsoBox x={182} y={204} w={30} h={22} d={6} topFill={`url(#${boxTop})`} frontFill={`url(#${boxFront})`} sideFill={`url(#${boxSide})`} stroke="hsl(var(--primary))" strokeOpacity={0.2} />
      </g>

      {/* ── Orders hub ── */}
      <g filter={`url(#${gradientId}-node-shadow)`}>
        <PlatformShadow cx={388} cy={276} rx={42} ry={12} />
        <Card3D x={354} y={184} w={68} h={82} ids={{ top: topGrad, front: frontGrad, side: sideGrad }} />
        <line x1={368} y1={206} x2={408} y2={206} stroke="hsl(var(--primary))" strokeOpacity={0.25} strokeWidth={1.4} />
        <line x1={368} y1={222} x2={400} y2={222} stroke="hsl(var(--primary))" strokeOpacity={0.18} strokeWidth={1.4} />
        <line x1={368} y1={238} x2={404} y2={238} stroke="hsl(var(--primary))" strokeOpacity={0.18} strokeWidth={1.4} />
        <rect x={368} y={252} width={38} height={12} rx={2} fill="hsl(var(--primary))" fillOpacity={0.12} />
      </g>

      {/* ── Fulfillment hub ── */}
      <g filter={`url(#${gradientId}-node-shadow)`}>
        <PlatformShadow cx={624} cy={272} rx={44} ry={12} />
        <IsoBox x={596} y={192} w={52} h={30} d={8} topFill={`url(#${boxTop})`} frontFill={`url(#${boxFront})`} sideFill={`url(#${boxSide})`} stroke="hsl(var(--primary))" strokeOpacity={0.25} />
        <path
          d="M 568 228 H 596 L 608 252 H 644 L 656 228 H 684"
          stroke="hsl(var(--primary))"
          strokeOpacity={0.3}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={588} cy={264} r={11} fill={`url(#${boxFront})`} stroke="hsl(var(--primary))" strokeOpacity={0.28} />
        <circle cx={656} cy={264} r={11} fill={`url(#${boxFront})`} stroke="hsl(var(--primary))" strokeOpacity={0.28} />
      </g>

      {/* ── Insights (3D bars) ── */}
      <g filter={`url(#${gradientId}-node-shadow)`}>
        <PlatformShadow cx={884} cy={278} rx={48} ry={12} />
        <line x1={832} y1={276} x2={952} y2={276} stroke="hsl(var(--primary))" strokeOpacity={0.15} strokeWidth={1.2} />
        {[
          { x: 848, h: 28, d: 6 },
          { x: 872, h: 44, d: 7 },
          { x: 896, h: 20, d: 5 },
          { x: 920, h: 36, d: 6 },
        ].map(({ x, h, d }) => (
          <IsoBox
            key={x}
            x={x}
            y={276 - h}
            w={14}
            h={h}
            d={d}
            topFill={`url(#${boxTop})`}
            frontFill={`url(#${boxFront})`}
            sideFill={`url(#${boxSide})`}
            stroke="hsl(var(--primary))"
            strokeOpacity={0.22}
          />
        ))}
        <path
          d="M 844 216 L 872 200 L 900 208 L 928 188 L 952 196"
          stroke="hsl(var(--accent))"
          strokeOpacity={0.35}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* ── Demand ── */}
      <g filter={`url(#${gradientId}-node-shadow)`}>
        <PlatformShadow cx={784} cy={330} rx={36} ry={10} />
        <Card3D x={754} y={282} w={60} h={40} ids={{ top: topGrad, front: frontGrad, side: sideGrad }} />
        <path
          d="M 762 312 L 776 300 L 790 306 L 804 292 L 818 298"
          stroke="hsl(var(--accent))"
          strokeOpacity={0.4}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* ── Procurement hub ── */}
      <g filter={`url(#${gradientId}-node-shadow)`}>
        <PlatformShadow cx={388} cy={330} rx={36} ry={10} />
        <Card3D x={354} y={282} w={60} h={40} ids={{ top: topGrad, front: frontGrad, side: sideGrad }} />
        <path d="M 366 302 H 394 M 380 292 V 312" stroke="hsl(var(--primary))" strokeOpacity={0.28} strokeWidth={1.4} strokeLinecap="round" />
        <IsoBox x={398} y={296} w={12} h={16} d={4} topFill={`url(#${boxTop})`} frontFill={`url(#${boxFront})`} sideFill={`url(#${boxSide})`} stroke="hsl(var(--primary))" strokeOpacity={0.2} />
      </g>

      {/* Labels */}
      <text x={164} y={148} textAnchor="middle" className="fill-muted-foreground/40 text-[12px] font-medium">
        Inventory
      </text>
      <text x={388} y={148} textAnchor="middle" className="fill-muted-foreground/40 text-[12px] font-medium">
        Orders
      </text>
      <text x={624} y={148} textAnchor="middle" className="fill-muted-foreground/40 text-[12px] font-medium">
        Fulfillment
      </text>
      <text x={884} y={148} textAnchor="middle" className="fill-muted-foreground/40 text-[12px] font-medium">
        Insights
      </text>
      <text x={388} y={338} textAnchor="middle" className="fill-muted-foreground/40 text-[12px] font-medium">
        Procurement
      </text>
      <text x={784} y={338} textAnchor="middle" className="fill-muted-foreground/40 text-[12px] font-medium">
        Demand
      </text>

      <g className="max-sm:hidden">
        {[
          [328, 112, "Web"],
          [384, 112, "Mobile"],
          [436, 112, "POS"],
          [588, 112, "Parcel"],
          [662, 112, "Carrier"],
          [318, 358, "Vendor"],
          [422, 358, "PO"],
        ].map(([x, y, label]) => (
          <text
            key={label as string}
            x={x as number}
            y={y as number}
            textAnchor="middle"
            className="fill-muted-foreground/30 text-[10px]"
          >
            {label as string}
          </text>
        ))}
      </g>
    </svg>
  );
}
