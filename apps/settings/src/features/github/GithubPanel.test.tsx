import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeApi, renderWithApi } from "~/app/test-utils";
import { GithubPanel } from "~/features/github/GithubPanel";
import { CHROME_EXTENSION_URL } from "~/features/github/constants";

async function openConsent() {
  const user = userEvent.setup();
  const view = await renderWithApi(<GithubPanel />);
  await user.click(screen.getByRole("button", { name: "Connect GitHub organisation" }));
  const dialog = await screen.findByRole("dialog", { name: "Simulated GitHub authorization" });
  return { user, dialog, ...view };
}

async function renderConnected() {
  const api = fakeApi();
  const { state } = await api.beginGithubInstall();
  await api.completeGithubInstall(state, 51234567);
  const user = userEvent.setup();
  await renderWithApi(<GithubPanel />, api);
  return { user, api };
}

describe("the github panel", () => {
  it("explains why to connect and lists the requested permissions", async () => {
    await renderWithApi(<GithubPanel />);
    expect(screen.getByText(/shows the latest Infrared run/)).toBeTruthy();
    expect(screen.getByText(/Infrared opens migration pull requests/)).toBeTruthy();
    const permissions = screen.getByRole("list", { name: "Permissions" });
    expect(within(permissions).getAllByRole("listitem")).toHaveLength(4);
    expect(within(permissions).getAllByText("Read")).toHaveLength(3);
    expect(within(permissions).getAllByText("Write")).toHaveLength(1);
  });

  it("connects the organisation with all repositories", async () => {
    const { user, dialog, api } = await openConsent();
    expect(within(dialog).getByText("shopwave")).toBeTruthy();
    expect((within(dialog).getByRole("radio", { name: /All repositories/ }) as HTMLInputElement).checked).toBe(true);
    expect(within(dialog).queryByRole("checkbox")).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Install & authorize" }));

    expect(await screen.findByText("Connected")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("51234567")).toBeTruthy();
    expect(screen.getByText("14 Nov 2026")).toBeTruthy();
    expect(screen.getByText("All 5 repositories")).toBeTruthy();
    expect(screen.getByText(/Extension ready/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Get the Chrome extension" });
    expect(link.getAttribute("href")).toBe(CHROME_EXTENSION_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(within(screen.getByRole("list", { name: "How to use the extension" })).getAllByRole("listitem")).toHaveLength(3);
    expect(api.store.state.github.repoSelection).toEqual({ kind: "all" });
  });

  it("connects with only the selected repositories", async () => {
    const { user, dialog, api } = await openConsent();
    await user.click(within(dialog).getByRole("radio", { name: /Only select repositories/ }));
    const install = within(dialog).getByRole("button", { name: "Install & authorize" }) as HTMLButtonElement;
    expect(install.disabled).toBe(true);
    await user.click(within(dialog).getByRole("checkbox", { name: "shopwave/storefront" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "shopwave/infra" }));
    await user.click(install);

    expect(await screen.findByText("2 of 5 repositories")).toBeTruthy();
    expect(api.store.state.github.repoSelection).toEqual({ kind: "selected", repos: ["shopwave/storefront", "shopwave/infra"] });
  });

  it("leaves the organisation not connected when the consent is cancelled", async () => {
    const { user, dialog, api } = await openConsent();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Connect GitHub organisation" })).toBeTruthy();
    expect(api.store.state.github.status).toBe("not_connected");
  });

  it("shows an install error inside the consent", async () => {
    const { user, dialog, api } = await openConsent();
    api.completeGithubInstall = () => Promise.reject(new Error("The install session expired."));
    await user.click(within(dialog).getByRole("button", { name: "Install & authorize" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("The install session expired.");
  });

  it("shows a begin error as a danger notice", async () => {
    const api = fakeApi();
    api.beginGithubInstall = () => Promise.reject(new Error("GitHub is unreachable."));
    const user = userEvent.setup();
    await renderWithApi(<GithubPanel />, api);
    await user.click(screen.getByRole("button", { name: "Connect GitHub organisation" }));
    expect((await screen.findByRole("alert")).textContent).toContain("GitHub is unreachable.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("changes repository access", async () => {
    const { user, api } = await renderConnected();
    await user.click(screen.getByRole("button", { name: "Change repository access" }));
    const dialog = screen.getByRole("dialog", { name: "Repository access" });
    await user.click(within(dialog).getByRole("radio", { name: /Only select repositories/ }));
    for (const repo of ["shopwave/checkout-api", "shopwave/mobile-app", "shopwave/data-pipeline"]) {
      await user.click(within(dialog).getByRole("checkbox", { name: repo }));
    }
    await user.click(within(dialog).getByRole("button", { name: "Save access" }));

    expect(await screen.findByText("3 of 5 repositories")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.store.state.github.repoSelection).toEqual({
      kind: "selected",
      repos: ["shopwave/checkout-api", "shopwave/mobile-app", "shopwave/data-pipeline"],
    });

    await user.click(screen.getByRole("button", { name: "Change repository access" }));
    const again = screen.getByRole("dialog", { name: "Repository access" });
    expect((within(again).getByRole("checkbox", { name: "shopwave/mobile-app" }) as HTMLInputElement).checked).toBe(true);
    await user.click(within(again).getByRole("radio", { name: /All repositories/ }));
    await user.click(within(again).getByRole("button", { name: "Save access" }));
    expect(await screen.findByText("All 5 repositories")).toBeTruthy();
  });

  it("requires typing the organisation name to disconnect", async () => {
    const { user, api } = await renderConnected();
    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    const dialog = screen.getByRole("dialog", { name: "Disconnect shopwave?" });
    expect(within(dialog).getByText(/uninstall the\s+Infrared app/)).toBeTruthy();
    const confirm = within(dialog).getByRole("button", { name: "Disconnect organisation" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await user.type(within(dialog).getByRole("textbox"), "shopwav");
    expect(confirm.disabled).toBe(true);
    await user.type(within(dialog).getByRole("textbox"), "e");
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);

    expect(await screen.findByRole("button", { name: "Connect GitHub organisation" })).toBeTruthy();
    expect(api.store.state.github.status).toBe("not_connected");
  });

  it("warns when the app was suspended in GitHub and keeps connect disabled", async () => {
    const api = fakeApi((seed) => {
      seed.github = {
        ...seed.github,
        status: "suspended",
        org: "shopwave",
        installationId: 51234567,
        availableRepos: ["shopwave/storefront"],
        installedAt: "2026-10-02T09:00:00Z",
      };
    });
    await renderWithApi(<GithubPanel />, api);
    expect(screen.getByRole("status").textContent).toMatch(/suspended in GitHub.*Unsuspend it/);
    expect((screen.getByRole("button", { name: "Connect GitHub organisation" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Suspended")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Change repository access" })).toBeNull();
  });
});
