import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Collapse, { COLLAPSE_MS } from "./Collapse.tsx";

afterEach(() => {
  vi.useRealTimers();
});

describe("Collapse", () => {
  it("hides its content while closed, from sight and from screen readers", () => {
    const { rerender } = render(
      <Collapse open={false} id="panel">
        <button type="button">Inside</button>
      </Collapse>,
    );
    expect(screen.queryByRole("button", { name: "Inside" })).not.toBeInTheDocument();
    expect(document.getElementById("panel")).toHaveAttribute("inert");

    rerender(
      <Collapse open id="panel">
        <button type="button">Inside</button>
      </Collapse>,
    );
    expect(screen.getByRole("button", { name: "Inside" })).toBeVisible();
    expect(document.getElementById("panel")).not.toHaveAttribute("inert");
  });

  it("with lazy, mounts the content when it opens and unmounts it once it has rolled up", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Collapse open={false} lazy>Loaded</Collapse>);
    expect(screen.queryByText("Loaded")).not.toBeInTheDocument();

    rerender(<Collapse open lazy>Loaded</Collapse>);
    expect(screen.getByText("Loaded")).toBeVisible();

    rerender(<Collapse open={false} lazy>Loaded</Collapse>);
    expect(screen.getByText("Loaded")).not.toBeVisible(); // still there while it rolls up
    act(() => vi.advanceTimersByTime(COLLAPSE_MS));
    expect(screen.queryByText("Loaded")).not.toBeInTheDocument();
  });
});
