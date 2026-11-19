import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TOAST_MS, ToastProvider, useToast } from "./Toast.tsx";

function Trigger({ message }: { message: string }) {
  const showToast = useToast();
  return <button onClick={() => showToast(message)}>{message}</button>;
}

function renderToasts() {
  render(
    <ToastProvider>
      <Trigger message="Invite link copied." />
      <Trigger message="You joined Maple St House." />
    </ToastProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("shows a message where screen readers announce it, then takes it away by itself", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    renderToasts();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    fireEvent.click(screen.getByRole("button", { name: "Invite link copied." }));
    expect(screen.getByRole("status")).toHaveTextContent("Invite link copied.");

    await act(() => vi.advanceTimersByTimeAsync(TOAST_MS - 1));
    expect(screen.getByRole("status")).toHaveTextContent("Invite link copied.");

    await act(() => vi.advanceTimersByTimeAsync(1)); // starts fading
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows one message at a time: a new one replaces the last and gets its full time", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    renderToasts();

    fireEvent.click(screen.getByRole("button", { name: "Invite link copied." }));
    await act(() => vi.advanceTimersByTimeAsync(TOAST_MS - 500));
    fireEvent.click(screen.getByRole("button", { name: "You joined Maple St House." }));
    await act(() => vi.advanceTimersByTimeAsync(TOAST_MS - 500));

    expect(screen.getByRole("status")).toHaveTextContent(/^You joined Maple St House\.$/);
  });

  it("does nothing outside a ToastProvider", async () => {
    render(<Trigger message="Invite link copied." />);

    await userEvent.click(screen.getByRole("button"));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
