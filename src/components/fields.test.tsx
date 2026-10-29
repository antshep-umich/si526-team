// PickerField, DateField and TextArea: the Add chore form's fields.
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DateField from "./DateField.tsx";
import PickerField from "./PickerField.tsx";
import TextArea from "./TextArea.tsx";

const housemates = [
  { value: "u-ana", label: "You" },
  { value: "u-ben", label: "Ben Ito" },
  { value: "u-cy", label: "Cy Park" },
];

function Picker(props: { error?: string; hint?: string; onChange?: (value: string) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <PickerField
      label="Assigned to"
      placeholder="Select a housemate"
      options={housemates}
      value={value}
      onChange={(next) => {
        setValue(next);
        props.onChange?.(next);
      }}
      error={props.error}
      hint={props.hint}
    />
  );
}

describe("PickerField", () => {
  it("is a closed combobox showing the placeholder", () => {
    render(<Picker />);

    const field = screen.getByRole("combobox", { name: "Assigned to" });
    expect(field).toHaveTextContent("Select a housemate");
    expect(field).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(); // hidden
  });

  it("opens on a tap, lists the options, and picks one", async () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    const field = screen.getByRole("combobox", { name: "Assigned to" });

    await userEvent.click(field);
    expect(field).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["You", "Ben Ito", "Cy Park"]);

    await userEvent.click(screen.getByRole("option", { name: "Ben Ito" }));

    expect(onChange).toHaveBeenCalledWith("u-ben");
    expect(field).toHaveTextContent("Ben Ito");
    expect(field).toHaveAttribute("aria-expanded", "false");
  });

  it("works from the keyboard: arrows move, Enter picks, Escape closes", async () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    const field = screen.getByRole("combobox", { name: "Assigned to" });

    await userEvent.tab();
    expect(field).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(field).toHaveAttribute("aria-expanded", "true");
    expect(field).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "You" }).id);

    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("u-cy");

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "Cy Park" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Escape}");
    expect(field).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when focus leaves it", async () => {
    render(
      <>
        <Picker />
        <button type="button">Next</button>
      </>,
    );
    const field = screen.getByRole("combobox", { name: "Assigned to" });

    await userEvent.click(field);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(field).toHaveAttribute("aria-expanded", "false");
  });

  it("shows an error and a hint, both read with the field", () => {
    render(<Picker error="Choose who this chore is assigned to." hint="Invite housemates with code K7Q2MXAB." />);

    const field = screen.getByRole("combobox", { name: "Assigned to" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Choose who this chore is assigned to. Invite housemates with code K7Q2MXAB.");
  });
});

describe("DateField", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is a labelled date input showing the placeholder until a date is picked", () => {
    render(<DateField label="Due date" placeholder="Pick a date" value="" onChange={() => {}} min="2026-10-29" />);

    const input = screen.getByLabelText("Due date");
    expect(input).toHaveAttribute("type", "date");
    expect(input).toHaveAttribute("min", "2026-10-29");
    expect(screen.getByText("Pick a date")).toHaveClass("datePlaceholder");
  });

  it("shows the picked date as a short date, and reports changes", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 29, 12));
    const onChange = vi.fn();
    render(<DateField label="Due date" placeholder="Pick a date" value="2026-10-30" onChange={onChange} />);

    expect(screen.getByText("Fri, Oct 30")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-11-02" } });
    expect(onChange).toHaveBeenCalledWith("2026-11-02");
  });

  it("shows an error under the field", () => {
    render(<DateField label="Due date" placeholder="Pick a date" value="" onChange={() => {}} error="Choose a due date." />);

    expect(screen.getByLabelText("Due date")).toHaveAccessibleDescription("Choose a due date.");
  });
});

describe("TextArea", () => {
  it("is a labelled multi-line field that passes attributes through", async () => {
    const onChange = vi.fn();
    render(<TextArea label="Notes (optional)" placeholder="Add any details…" onChange={onChange} />);

    const area = screen.getByLabelText("Notes (optional)");
    expect(area.tagName).toBe("TEXTAREA");
    expect(area).toHaveAttribute("placeholder", "Add any details…");
    await userEvent.type(area, "Bins");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows an error under the field", () => {
    render(<TextArea label="Notes (optional)" error="Notes must be 200 characters or fewer." />);

    const area = screen.getByLabelText("Notes (optional)");
    expect(area).toHaveAttribute("aria-invalid", "true");
    expect(area).toHaveAccessibleDescription("Notes must be 200 characters or fewer.");
  });
});
