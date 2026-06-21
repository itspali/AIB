"use client";

import type { ReactNode } from "react";
import {
  entitySubsectionClass,
  entitySubsectionTitleClass,
} from "@/lib/entities/entity-editor-chrome";

type Props = {
  title: string;
  children: ReactNode;
};

export function EntityFormSubsection({ title, children }: Props) {
  return (
    <div className={entitySubsectionClass()}>
      <p className={entitySubsectionTitleClass()}>{title}</p>
      {children}
    </div>
  );
}
