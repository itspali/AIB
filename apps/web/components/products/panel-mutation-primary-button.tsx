"use client";

import { MutationPrimaryButton } from "@/components/layout/mutation-form/mutation-primary-button";

type Props = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
};

/** @deprecated Use {@link MutationPrimaryButton} from `@/components/layout/mutation-form`. */
export function PanelMutationPrimaryButton(props: Props) {
  return <MutationPrimaryButton {...props} />;
}
