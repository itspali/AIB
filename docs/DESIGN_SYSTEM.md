# AIB Smart ERP: Frontend Core Design System

This document provides the layout patterns and component rules for the AIB responsive web framework. Cursor must follow these constraints to build uniform UI/UX structures across Next.js, Tailwind CSS, and Shadcn/UI.

## 1. Structural Canvas Design System (Three-Zone Dashboard Grid)
The desktop application canvas follows a strict structural grid layout to manage administrative overhead efficiently:
1. **Zone A (Top Utility Strip)**: High-efficiency toolbar pinned at `h-16` holding global cross-tenant quick actions, command search triggers (Cmd/Ctrl + K), notification center badges, and user account contextual menus.
2. **Zone B (Collapsible Left Rail Navigation Menu)**: Vertical navigation framework at a static width of `w-64`. It handles deep ERP structural modules (Procurement, Inventory, Sales, Financials) and supports smooth animation collapse to icon-only view (`w-16`).
3. **Zone C (Active Workspace Core Canvas Container)**: Flexible main layout segment leveraging auto-scrolling containers (`overflow-y-auto`) with responsive padding configurations (`p-4 md:p-6 lg:p-8`).

## 2. Fluid Breakpoint & Mobile Form Adaptation Layouts
To protect complex tables and multi-step forms on compact viewports, the layout must adapt using responsive utility triggers:
- **Responsive Navigation Shift**: When screen resolution hits mobile breakpoints (`max-width: 768px`), Zone B (Left Menu) collapses entirely out of view. The navigation options must seamlessly relocate to a fixed **Bottom Action Tab Bar** or an accessible slide-out mobile drawer interface.
- **Form Columns Mapping**: Form fields must automatically rearrange themselves to prevent layout squishing:
  - Desktop viewports (`lg`): 3 to 4 sequential semantic grid layout columns.
  - Tablet viewports (`md`): 2 balanced presentation grid layout columns.
  - Mobile viewports (`sm`): 1 absolute full-width stack.

## 3. Typographical Scale & UI Element Hierarchy
- **System Interface Type Family**: Maps directly to modern neutral sans-serif typography stacks (`Geist Sans` or `Inter`) optimizing rendering performance across high-resolution displays.
- **Sizing Constraints**:
  - H1 / Dashboard Headers: `text-2xl font-bold tracking-tight`
  - H2 / Section Boundaries: `text-xl font-semibold`
  - Form Label Elements: `text-sm font-medium text-muted-foreground`
  - Base Component Typography: `text-sm font-normal`

## 4. Interaction States, Empty Views, and Progressive Disclosure (Point 5)
- **Action Elements**: Interactive components must include explicit transition behaviors (`transition-colors duration-200`) and visually separate states (`hover:bg-accent`, `focus-visible:ring-2`, `disabled:opacity-50`).
- **Pristine State Layouts (Empty States)**: List modules lacking current database rows must never display empty white boxes. They must serve structured instructional components holding descriptive text alerts, an illustrative icon vector, and an immediate actionable trigger button (e.g., "Create First Item").
- **UX Complexity Control (Progressive Disclosure)**: Multi-field entry forms must default to an "Essentials Only" layout. Advanced parameters, complex attributes, or uncommon configuration tags (such as inventory bin tags, alternate units of measure, or HSN custom codes) must remain hidden behind an explicit toggle element marked "Show Advanced Fields". This prevents cognitive overload for onboarding users.

## 5. Enterprise Data Tables & Precision Form Controls
- **Precision Financial Inputs**: Numeric fields manipulating currency values, unit prices, or tax allocation coefficients must utilize explicit right-aligned text alignments (`text-right`) and apply dedicated masks that strictly prohibit the submission of unformatted float decimals.
- **Transactional State Badges**: Document lifecycle parameters mapping straight to our multi-vector database enums (Commercial, Logistical, Financial) must display using distinct, low-saturation contextual status badges:
  - Success/Settled States (`FULLY_PAID`, `DELIVERED`): Emerald backgrounds with high-contrast text overlays.
  - Informational/Active States (`APPROVED_ACTIVE`, `DISPATCHED_IN_TRANSIT`): Soft indigo or sky blue layout blocks.
  - Critical/Hold States (`CREDIT_HOLD`, `PENDING_APPROVAL`, `UNPAID`): Muted amber or soft crimson alert palettes to immediately draw administrative attention.
- **Asynchronous Loading Skeletons**: Data table grids pulling live records through Supabase real-time queries must display localized animated skeleton layouts during state transitions instead of generic, full-screen spinners, preventing layout shifts during data processing loops.