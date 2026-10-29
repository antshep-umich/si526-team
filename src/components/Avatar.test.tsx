import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Avatar, { initialsOf } from "./Avatar.tsx";

describe("initialsOf", () => {
  it.each([
    ["Anthony Shephard", "AS"],
    ["riley jones", "RJ"],
    ["Mary Anne Smith", "MS"],
    ["Sam", "S"],
    ["  Jo   Lee  ", "JL"],
    ["", ""],
  ])("makes %j into %j", (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});

describe("Avatar", () => {
  it("shows initials and names the person for screen readers", () => {
    render(<Avatar name="Anthony Shephard" />);

    const avatar = screen.getByRole("img", { name: "Anthony Shephard" });
    expect(avatar).toHaveTextContent("AS");
  });
});
