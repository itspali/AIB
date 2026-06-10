import { describe, expect, it } from "vitest";
import {
  resolveAddedLineScrollTargetKey,
  scrollElementWithinOverflowContainer,
} from "@/lib/documents/scroll-container-into-view";

describe("resolveAddedLineScrollTargetKey", () => {
  it("returns the trailing key when a row is appended", () => {
    expect(
      resolveAddedLineScrollTargetKey(["a", "b"], ["a", "b", "c"], "bottom")
    ).toBe("c");
  });

  it("returns the leading key when a row is prepended", () => {
    expect(resolveAddedLineScrollTargetKey(["b"], ["a", "b"], "top")).toBe("a");
  });

  it("returns null when line count is unchanged", () => {
    expect(resolveAddedLineScrollTargetKey(["a"], ["a"], "bottom")).toBeNull();
  });
});

describe("scrollElementWithinOverflowContainer", () => {
  it("scrolls down when the element extends below the container", () => {
    const container = {
      scrollTop: 100,
      getBoundingClientRect: () => ({ top: 0, bottom: 200 }),
    } as HTMLElement;
    const element = {
      getBoundingClientRect: () => ({ top: 150, bottom: 230 }),
    } as HTMLElement;

    const scrolled = scrollElementWithinOverflowContainer(container, element, { edge: "end" });

    expect(scrolled).toBe(true);
    expect(container.scrollTop).toBe(134);
  });

  it("scrolls up when the element extends above the container", () => {
    const container = {
      scrollTop: 100,
      getBoundingClientRect: () => ({ top: 0, bottom: 200 }),
    } as HTMLElement;
    const element = {
      getBoundingClientRect: () => ({ top: -20, bottom: 40 }),
    } as HTMLElement;

    const scrolled = scrollElementWithinOverflowContainer(container, element, { edge: "start" });

    expect(scrolled).toBe(true);
    expect(container.scrollTop).toBe(76);
  });
});
