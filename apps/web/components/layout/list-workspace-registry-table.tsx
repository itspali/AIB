"use client";

import type { CSSProperties, ReactNode, Ref } from "react";
import {
  LIST_TABLE_ROOT,
  LIST_TABLE_SURFACE,
  LIST_WORKSPACE_REGISTRY_HEADER,
  LIST_WORKSPACE_REGISTRY_HEADER_BTN,
  LIST_WORKSPACE_REGISTRY_HEADER_BTN_ACTIVE,
  LIST_WORKSPACE_REGISTRY_HEADER_LABEL,
  LIST_WORKSPACE_REGISTRY_HEADER_SELECT,
  LIST_WORKSPACE_REGISTRY_SELECT_CELL,
  LIST_WORKSPACE_REGISTRY_SELECT_CELL_INNER,
  LIST_WORKSPACE_REGISTRY_TABLE_WRAPPER,
  listTableSortHeaderClass,
} from "@/lib/layout/list-table-chrome";
import {
  REGISTRY_TABLE_CELL_CONTENT,
  registryTableBodyCellTypographyClass,
} from "@/lib/list-columns/registry-table-typography";
import type { ListColumnDef } from "@/lib/list-columns/types";
import { cn } from "@/lib/utils";

type RegistryTableFrameProps = {
  children: ReactNode;
  className?: string;
  scrollClassName?: string;
  scrollRef?: Ref<HTMLDivElement>;
};

/** Document-style list table shell (split + matrix) — scrollport matches Items `matrix-table-wrapper`. */
export function ListWorkspaceRegistryTableFrame({
  children,
  className,
  scrollClassName,
  scrollRef,
}: RegistryTableFrameProps) {
  return (
    <div className={cn(LIST_TABLE_ROOT, className)}>
      <div className={LIST_TABLE_SURFACE}>
        <div
          ref={scrollRef}
          className={cn(LIST_WORKSPACE_REGISTRY_TABLE_WRAPPER, scrollClassName)}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** Items matrix registry scrollport only (inside `ListWorkspaceMatrixRegistry`). */
export function ListWorkspaceRegistryTableScroll({
  children,
  className,
  scrollRef,
}: Omit<RegistryTableFrameProps, "scrollClassName">) {
  return (
    <div ref={scrollRef} className={cn(LIST_WORKSPACE_REGISTRY_TABLE_WRAPPER, className)}>
      {children}
    </div>
  );
}

type RegistryHeaderCellProps = {
  label: string;
  sortable?: boolean;
  active?: boolean;
  sortDirection?: "asc" | "desc";
  onSort?: () => void;
  align?: "left" | "right" | "center";
  className?: string;
  style?: CSSProperties;
  headerRef?: Ref<HTMLTableCellElement>;
  scope?: "col" | "row";
  resizeHandle?: ReactNode;
};

/** Items-master registry column header — `matrix-table__header` markup (no variations). */
export function ListWorkspaceRegistryHeaderCell({
  label,
  sortable = false,
  active = false,
  sortDirection,
  onSort,
  align,
  className,
  style,
  headerRef,
  scope = "col",
  resizeHandle,
}: RegistryHeaderCellProps) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : undefined;
  const btnAlignClass = align === "right" ? "justify-end" : undefined;

  return (
    <th
      ref={headerRef}
      scope={scope}
      style={style}
      className={cn(LIST_WORKSPACE_REGISTRY_HEADER, alignClass, className)}
      aria-sort={
        sortable
          ? active
            ? sortDirection === "asc"
              ? "ascending"
              : "descending"
            : "none"
          : undefined
      }
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            LIST_WORKSPACE_REGISTRY_HEADER_BTN,
            btnAlignClass,
            active && LIST_WORKSPACE_REGISTRY_HEADER_BTN_ACTIVE,
            listTableSortHeaderClass(active)
          )}
          aria-label={`Sort by ${label}${
            active ? ` (${sortDirection === "asc" ? "ascending" : "descending"})` : ""
          }`}
        >
          <span className={cn(LIST_WORKSPACE_REGISTRY_HEADER_LABEL, "truncate")}>{label}</span>
        </button>
      ) : (
        <span className={cn(LIST_WORKSPACE_REGISTRY_HEADER_LABEL, "truncate")}>{label}</span>
      )}
      {resizeHandle}
    </th>
  );
}

type RegistrySelectHeaderCellProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  cellRef?: Ref<HTMLTableCellElement>;
};

/** Items-master bulk-select header — `matrix-table__header matrix-table__select`. */
export function ListWorkspaceRegistrySelectHeaderCell({
  children,
  className,
  style,
  cellRef,
}: RegistrySelectHeaderCellProps) {
  return (
    <th
      ref={cellRef}
      className={cn(LIST_WORKSPACE_REGISTRY_HEADER, LIST_WORKSPACE_REGISTRY_HEADER_SELECT, className)}
      style={style}
    >
      <div
        className={LIST_WORKSPACE_REGISTRY_SELECT_CELL_INNER}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </th>
  );
}

type RegistrySelectBodyCellProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  cellRef?: Ref<HTMLTableCellElement>;
};

/** Items-master bulk-select body cell — `matrix-table__select` + aligned checkbox lane. */
export function ListWorkspaceRegistrySelectBodyCell({
  children,
  className,
  style,
  cellRef,
}: RegistrySelectBodyCellProps) {
  return (
    <td
      ref={cellRef}
      className={cn(LIST_WORKSPACE_REGISTRY_SELECT_CELL, className)}
      style={style}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className={LIST_WORKSPACE_REGISTRY_SELECT_CELL_INNER}>{children}</div>
    </td>
  );
}

type RegistryBodyCellProps = {
  column: ListColumnDef;
  columnId: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/** Registry data cell — matrix typography + content wrapper (Items master parity). */
export function ListWorkspaceRegistryBodyCell({
  column,
  columnId,
  children,
  className,
  style,
}: RegistryBodyCellProps) {
  return (
    <td
      className={cn(
        registryTableBodyCellTypographyClass(column, columnId),
        column.align === "center" && "text-center",
        column.align === "right" && "text-right",
        className
      )}
      style={style}
    >
      <div className={REGISTRY_TABLE_CELL_CONTENT}>{children}</div>
    </td>
  );
}
