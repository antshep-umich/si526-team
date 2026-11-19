import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import AppearanceSection from "./AppearanceSection.tsx";

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("Appearance", () => {
  it("offers System, Light and Dark, starting on System", () => {
    render(<AppearanceSection />);

    expect(screen.getByRole("heading", { level: 2, name: "Appearance" })).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Appearance" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
  });

  it("switches the app's mode at once and keeps it for next time", async () => {
    const { unmount } = render(<AppearanceSection />);

    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    unmount();
    render(<AppearanceSection />);
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  });

  it("hands it back to the phone with System", async () => {
    render(<AppearanceSection />);
    await userEvent.click(screen.getByRole("radio", { name: "Light" }));

    await userEvent.click(screen.getByRole("radio", { name: "System" }));

    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });
});
