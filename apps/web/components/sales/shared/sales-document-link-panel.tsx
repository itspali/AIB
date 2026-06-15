"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  linkSalesInvoiceToOrder,
  linkSalesInvoiceToQuotation,
  linkSalesOrderToQuotation,
  linkSalesQuotationToInvoice,
  linkSalesQuotationToOrder,
  searchLinkableInvoicesForQuote,
  searchLinkableQuotesForInvoiceSlot,
  searchLinkableQuotesForOrderSlot,
  searchLinkableSalesOrders,
  searchLinkableSalesOrdersForQuote,
  type LinkableDocumentOption,
} from "@/app/sales/link-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SALES_INVOICES_HREF,
  SALES_ORDERS_HREF,
  SALES_QUOTES_HREF,
} from "@/lib/sales/navigation";
import { popoverAboveDrawerClassName } from "@/lib/layout/overlay-z-index";
import { cn } from "@/lib/utils";

export type SalesDocumentLinkRef = {
  id: string;
  number: string;
  href: string;
};

type LinkTargetKind = "quote" | "sales_order" | "invoice";

type LinkActionConfig = {
  label: string;
  search: (customerId: string, query: string) => Promise<
    { options: LinkableDocumentOption[] } | { error: string }
  >;
  link: (payload: Record<string, string>) => Promise<{ success?: true; error?: string }>;
  buildPayload: (documentId: string, targetId: string) => Record<string, string>;
};

type Props = {
  documentType: "quote" | "sales_order" | "invoice";
  documentId: string;
  customerId: string;
  editAccessGranted: boolean;
  sourceQuote?: SalesDocumentLinkRef | null;
  convertedOrder?: SalesDocumentLinkRef | null;
  convertedInvoice?: SalesDocumentLinkRef | null;
  sourceOrder?: SalesDocumentLinkRef | null;
  relatedInvoices?: SalesDocumentLinkRef[];
  onLinked?: () => void;
};

function documentPeekHref(kind: LinkTargetKind, id: string): string {
  if (kind === "quote") return `${SALES_QUOTES_HREF}?id=${encodeURIComponent(id)}`;
  if (kind === "sales_order") return `${SALES_ORDERS_HREF}?id=${encodeURIComponent(id)}`;
  return `${SALES_INVOICES_HREF}?id=${encodeURIComponent(id)}`;
}

function LinkRefRow({ label, link }: { label: string; link: SalesDocumentLinkRef }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-sm">{link.number}</p>
      </div>
      <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs" asChild>
        <Link href={link.href}>Open</Link>
      </Button>
    </div>
  );
}

function DocumentLinkPicker({
  config,
  customerId,
  documentId,
  disabled,
  onLinked,
}: {
  config: LinkActionConfig;
  customerId: string;
  documentId: string;
  disabled?: boolean;
  onLinked?: () => void;
}) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<LinkableDocumentOption[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [isPending, startTransition] = useTransition();

  const loadOptions = useCallback(
    (searchQuery: string) => {
      startTransition(async () => {
        const result = await config.search(customerId, searchQuery);
        if ("error" in result) {
          toast.error(result.error);
          setOptions([]);
          return;
        }
        setOptions(result.options);
        setHighlightIndex(0);
      });
    },
    [config, customerId]
  );

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => loadOptions(query), 200);
    return () => window.clearTimeout(timer);
  }, [loadOptions, open, query]);

  const handleLink = (targetId: string) => {
    startTransition(async () => {
      const result = await config.link(config.buildPayload(documentId, targetId));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Documents linked.");
      setOpen(false);
      setQuery("");
      onLinked?.();
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{config.label}</p>
      <div className="relative">
        <Input
          value={query}
          disabled={disabled || isPending}
          placeholder="Search by document number…"
          className="h-8 text-sm"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            if (options.length === 0) loadOptions(query);
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlightIndex((current) => Math.min(current + 1, Math.max(options.length - 1, 0)));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightIndex((current) => Math.max(current - 1, 0));
            }
            if (event.key === "Enter" && open && options[highlightIndex]) {
              event.preventDefault();
              handleLink(options[highlightIndex]!.id);
            }
          }}
        />
        {open ? (
          <ul
            id={listboxId}
            role="listbox"
            className={cn(
              "absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md",
              popoverAboveDrawerClassName
            )}
          >
            {isPending ? (
              <li className="px-2.5 py-2 text-sm text-muted-foreground">Searching…</li>
            ) : options.length === 0 ? (
              <li className="px-2.5 py-2 text-sm text-muted-foreground">No matching documents.</li>
            ) : (
              options.map((option, index) => (
                <li key={option.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    className={cn(
                      "flex w-full flex-col rounded-sm px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/70",
                      index === highlightIndex && "bg-accent text-accent-foreground"
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleLink(option.id)}
                  >
                    <span className="font-mono font-medium">{option.number}</span>
                    <span className="text-xs text-muted-foreground">{option.status}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function SalesDocumentLinkPanel({
  documentType,
  documentId,
  customerId,
  editAccessGranted,
  sourceQuote = null,
  convertedOrder = null,
  convertedInvoice = null,
  sourceOrder = null,
  relatedInvoices = [],
  onLinked,
}: Props) {
  const linkActions = useMemo((): LinkActionConfig[] => {
    if (documentType === "sales_order") {
      if (sourceQuote) return [];
      return [
        {
          label: "Link to quote",
          search: (customer_id, query) =>
            searchLinkableQuotesForOrderSlot({ customer_id, query }),
          link: (payload) => linkSalesOrderToQuotation(payload),
          buildPayload: (sales_order_id, quotation_id) => ({
            sales_order_id,
            quotation_id,
          }),
        },
      ];
    }

    if (documentType === "invoice") {
      const actions: LinkActionConfig[] = [];
      if (!sourceOrder) {
        actions.push({
          label: "Link to sales order",
          search: (customer_id, query) => searchLinkableSalesOrders({ customer_id, query }),
          link: (payload) => linkSalesInvoiceToOrder(payload),
          buildPayload: (sales_invoice_id, sales_order_id) => ({
            sales_invoice_id,
            sales_order_id,
          }),
        });
      }
      if (!sourceQuote) {
        actions.push({
          label: "Link to quote",
          search: (customer_id, query) =>
            searchLinkableQuotesForInvoiceSlot({ customer_id, query }),
          link: (payload) => linkSalesInvoiceToQuotation(payload),
          buildPayload: (sales_invoice_id, quotation_id) => ({
            sales_invoice_id,
            quotation_id,
          }),
        });
      }
      return actions;
    }

    const actions: LinkActionConfig[] = [];
    if (!convertedOrder) {
      actions.push({
        label: "Link to sales order",
        search: (customer_id, query) => searchLinkableSalesOrdersForQuote({ customer_id, query }),
        link: (payload) => linkSalesQuotationToOrder(payload),
        buildPayload: (quotation_id, sales_order_id) => ({
          quotation_id,
          sales_order_id,
        }),
      });
    }
    if (!convertedInvoice) {
      actions.push({
        label: "Link to invoice",
        search: (customer_id, query) => searchLinkableInvoicesForQuote({ customer_id, query }),
        link: (payload) => linkSalesQuotationToInvoice(payload),
        buildPayload: (quotation_id, sales_invoice_id) => ({
          quotation_id,
          sales_invoice_id,
        }),
      });
    }
    return actions;
  }, [convertedInvoice, convertedOrder, documentType, sourceOrder, sourceQuote]);

  const hasLinks =
    Boolean(sourceQuote) ||
    Boolean(convertedOrder) ||
    Boolean(convertedInvoice) ||
    Boolean(sourceOrder) ||
    relatedInvoices.length > 0;

  if (!hasLinks && (!editAccessGranted || linkActions.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-semibold tracking-tight">Related documents</p>

      {sourceQuote ? <LinkRefRow label="Source quote" link={sourceQuote} /> : null}
      {convertedOrder ? <LinkRefRow label="Sales order" link={convertedOrder} /> : null}
      {convertedInvoice ? <LinkRefRow label="Invoice" link={convertedInvoice} /> : null}
      {sourceOrder ? <LinkRefRow label="Source sales order" link={sourceOrder} /> : null}

      {relatedInvoices.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Invoices from this order</p>
          {relatedInvoices.map((invoice) => (
            <LinkRefRow key={invoice.id} label="Invoice" link={invoice} />
          ))}
        </div>
      ) : null}

      {editAccessGranted
        ? linkActions.map((config) => (
            <DocumentLinkPicker
              key={config.label}
              config={config}
              customerId={customerId}
              documentId={documentId}
              onLinked={onLinked}
            />
          ))
        : null}
    </div>
  );
}

export function toSalesDocumentLinkRef(
  kind: LinkTargetKind,
  id: string | null | undefined,
  number: string | null | undefined
): SalesDocumentLinkRef | null {
  if (!id || !number) return null;
  return { id, number, href: documentPeekHref(kind, id) };
}
