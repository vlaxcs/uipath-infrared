import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "~/shell/AccountMenu";

afterEach(cleanup);

function open(onNavigate = vi.fn(), onDisconnect = vi.fn()) {
  render(<AccountMenu onNavigate={onNavigate} onDisconnect={onDisconnect} />);
  const button = screen.getByRole("button", { name: "Account menu" });
  fireEvent.click(button);
  return { button, onNavigate, onDisconnect };
}

describe("the account menu", () => {
  it("is closed until the avatar is pressed", () => {
    render(<AccountMenu onNavigate={vi.fn()} onDisconnect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Account menu" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("lists Configuration, Account and Disconnect in that order", () => {
    const { button } = open();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Configuration", "Account", "Disconnect"]);
  });

  it("opens Configuration and Account, and closes", () => {
    const { onNavigate } = open();
    fireEvent.click(screen.getByRole("menuitem", { name: "Configuration" }));
    expect(onNavigate).toHaveBeenCalledWith("configuration");
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Account" }));
    expect(onNavigate).toHaveBeenCalledWith("account");
  });

  it("disconnects", () => {
    const { onDisconnect } = open();
    fireEvent.click(screen.getByRole("menuitem", { name: "Disconnect" }));
    expect(onDisconnect).toHaveBeenCalledOnce();
  });

  it("closes on Escape and gives focus back to the avatar", () => {
    const { button } = open();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("moves between items with the arrow keys", () => {
    open();
    const items = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[2]);
  });
});
