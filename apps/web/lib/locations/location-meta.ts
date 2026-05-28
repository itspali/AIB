import type { NamingSequenceEntry } from "@/lib/naming/sequences";
import { parseNamingSequences } from "@/lib/naming/sequences";
import type { VirtualLocationConfiguration } from "@/lib/locations/virtual-config";
import { buildVirtualConfigurationMetadataPatch } from "@/lib/locations/virtual-config";

export function parseLocationNamingSequences(raw: unknown): Record<string, NamingSequenceEntry> {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const configurationMetadata =
    root.configuration_metadata && typeof root.configuration_metadata === "object"
      ? (root.configuration_metadata as Record<string, unknown>)
      : root;
  return parseNamingSequences(configurationMetadata.naming_sequences);
}

export function buildNamingConfigurationMetadataPatch(
  sequences: Record<string, NamingSequenceEntry>
): Record<string, unknown> {
  return {
    configuration_metadata: {
      naming_sequences: sequences,
    },
  };
}

type LocationFormValuesCodeGeneration = {
  scope: string;
  role: string;
  sequence: number;
  role_key: string;
  suggested_code: string;
};

export type BuildLocationMetaInput = {
  presence_type: "PHYSICAL" | "VIRTUAL";
  existing_meta?: Record<string, unknown>;
  code_generation?: LocationFormValuesCodeGeneration | null;
  code_manually_edited?: boolean;
  virtual_configuration?: VirtualLocationConfiguration;
  naming_sequences?: Record<string, NamingSequenceEntry>;
};

export function buildLocationMetaPatch(input: BuildLocationMetaInput): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...(input.existing_meta ?? {}),
  };

  if (input.code_generation) {
    merged.code_generation = {
      ...input.code_generation,
      manually_edited: input.code_manually_edited ?? false,
      generated_at: new Date().toISOString(),
    };
  }

  const existingConfiguration =
    merged.configuration_metadata && typeof merged.configuration_metadata === "object"
      ? { ...(merged.configuration_metadata as Record<string, unknown>) }
      : {};

  const nextConfiguration: Record<string, unknown> = { ...existingConfiguration };

  if (input.naming_sequences) {
    nextConfiguration.naming_sequences = input.naming_sequences;
  }

  if (input.presence_type === "VIRTUAL" && input.virtual_configuration) {
    const virtualMetadata = buildVirtualConfigurationMetadataPatch(input.virtual_configuration)
      .configuration_metadata as Record<string, unknown>;
    Object.assign(nextConfiguration, virtualMetadata);
  } else {
    delete nextConfiguration.virtual;
  }

  if (Object.keys(nextConfiguration).length > 0) {
    merged.configuration_metadata = nextConfiguration;
  } else {
    delete merged.configuration_metadata;
  }

  return merged;
}
