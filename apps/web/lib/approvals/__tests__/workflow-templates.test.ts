import { describe, expect, it } from "vitest";
import {
  buildManagerChainFinanceLevels,
  detectPoWorkflowTemplate,
  resolveWorkflowChoice,
} from "@/lib/approvals/workflow-templates";

describe("workflow-templates", () => {
  it("detects manager chain finance template", () => {
    const bands = [
      {
        min_amount: 0,
        max_amount: null,
        levels: buildManagerChainFinanceLevels(),
      },
    ];
    expect(detectPoWorkflowTemplate(bands)).toBe("manager_chain_finance");
    expect(resolveWorkflowChoice({ po_workflow_template: "manager_chain_finance" })).toBe(
      "manager_chain_finance"
    );
  });

  it("builds two levels with parallel finance step", () => {
    const levels = buildManagerChainFinanceLevels();
    expect(levels).toHaveLength(2);
    expect(levels[1]?.steps).toHaveLength(2);
  });
});
