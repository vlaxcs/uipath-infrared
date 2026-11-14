import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SaveProfileDialog } from "~/onboarding/SaveProfileDialog";

afterEach(cleanup);

const choice = () => ({ saving: false, onSave: vi.fn(), onSkip: vi.fn(), onBack: vi.fn() });

describe("the save-to-profile dialog", () => {
  it("is a modal dialog with the save button focused", () => {
    render(<SaveProfileDialog choice={choice()} />);
    const dialog = screen.getByRole("dialog", { name: "Save the on-prem details to your profile?" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Save to profile and start" }));
  });

  it("goes back to the form on Escape, and starts with or without saving from its buttons", () => {
    const actions = choice();
    render(<SaveProfileDialog choice={actions} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(actions.onBack).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Start without saving" }));
    expect(actions.onSkip).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save to profile and start" }));
    expect(actions.onSave).toHaveBeenCalled();
  });

  it("keeps Tab inside the dialog", () => {
    render(<SaveProfileDialog choice={choice()} />);
    const back = screen.getByRole("button", { name: "Back to the form" });
    back.focus();
    fireEvent.keyDown(back, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Save to profile and start" }));
  });
});
