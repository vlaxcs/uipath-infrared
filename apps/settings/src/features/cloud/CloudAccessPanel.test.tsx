import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fakeApi, renderWithApi } from "~/app/test-utils";
import { CloudAccessPanel } from "~/features/cloud/CloudAccessPanel";

const PROD = "AWS account 4123 4567 8901";

async function openConnectToArnStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Connect AWS account" }));
  const dialog = await screen.findByRole("dialog", { name: "Connect AWS account" });
  await user.click(within(dialog).getByRole("button", { name: "Next" }));
  return dialog;
}

describe("the cloud access panel", () => {
  it("explains what Infrared reads and never does", async () => {
    await renderWithApi(<CloudAccessPanel />);
    expect(screen.getByRole("heading", { name: "What Infrared can access" })).toBeTruthy();
    expect(screen.getByText("Create, change or delete any resource")).toBeTruthy();
    expect(screen.getByText("Read data inside S3 objects or databases")).toBeTruthy();
  });

  it("shows the connected seed account with its role, regions and actions", async () => {
    await renderWithApi(<CloudAccessPanel />);
    const card = screen.getByRole("article", { name: PROD });
    expect(within(card).getByText("Connected")).toBeTruthy();
    expect(within(card).getByText("arn:aws:iam::412345678901:role/InfraredReadOnly")).toBeTruthy();
    expect(within(card).getByText("eu-central-1")).toBeTruthy();
    expect(within(card).getByText("eu-west-1")).toBeTruthy();
    expect(within(card).getByText("14 Nov, 06:00 UTC")).toBeTruthy();
    for (const name of ["Re-verify", "Edit regions", "Rotate external ID", "Revoke"]) {
      expect(within(card).getByRole("button", { name })).toBeTruthy();
    }
  });

  it("shows an empty state when nothing is connected", async () => {
    await renderWithApi(<CloudAccessPanel />, fakeApi((seed) => (seed.cloud = [])));
    expect(screen.getByText("No AWS accounts connected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect AWS account" })).toBeTruthy();
  });

  it("connects a new account end to end", async () => {
    const user = userEvent.setup();
    await renderWithApi(<CloudAccessPanel />);
    await user.click(screen.getByRole("button", { name: "Connect AWS account" }));
    const dialog = await screen.findByRole("dialog", { name: "Connect AWS account" });
    expect(within(dialog).getByText("1. Create the role").closest("li")?.getAttribute("aria-current")).toBe("step");
    expect(within(dialog).getByText("External ID")).toBeTruthy();
    expect(within(dialog).getByText("Trust policy")).toBeTruthy();
    expect(within(dialog).getByText("Permissions policy")).toBeTruthy();
    const launch = within(dialog).getByRole("link", { name: "Launch CloudFormation stack" });
    expect(launch.getAttribute("target")).toBe("_blank");
    expect(launch.getAttribute("rel")).toBe("noreferrer");
    expect(launch.getAttribute("href")).toContain("stackName=InfraredReadOnly");
    expect(screen.getByRole("article", { name: "New AWS connection" })).toBeTruthy();

    await user.click(within(dialog).getByRole("button", { name: "Next" }));
    await user.type(within(dialog).getByLabelText("Role ARN"), "arn:aws:iam::555566667777:role/InfraredReadOnly");
    await user.click(within(dialog).getByRole("button", { name: "Verify" }));

    expect(await within(dialog).findByText(/Connected AWS account 5555 6666 7777/)).toBeTruthy();
    expect(within(dialog).getByText("eu-central-1")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    const card = screen.getByRole("article", { name: "AWS account 5555 6666 7777" });
    expect(within(card).getByText("Connected")).toBeTruthy();
  });

  it("shows the error and a failed card when the role cannot be assumed", async () => {
    const user = userEvent.setup();
    await renderWithApi(<CloudAccessPanel />);
    const dialog = await openConnectToArnStep(user);
    await user.type(within(dialog).getByLabelText("Role ARN"), "arn:aws:iam::555566667777:role/denied-role");
    await user.click(within(dialog).getByRole("button", { name: "Verify" }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain("could not assume the role");
    await user.click(within(dialog).getByRole("button", { name: "Back" }));
    expect((within(dialog).getByLabelText("Role ARN") as HTMLInputElement).value).toBe("arn:aws:iam::555566667777:role/denied-role");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    const card = screen.getByRole("article", { name: "AWS account 5555 6666 7777" });
    expect(within(card).getByText("Failed")).toBeTruthy();
    expect(within(card).getByRole("alert").textContent).toContain("999988887777");
    expect(within(card).getByRole("button", { name: "Continue setup" })).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Remove" })).toBeTruthy();
  });

  it("validates the role ARN inline without calling the api", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    const verify = vi.spyOn(api, "verifyAwsConnection");
    await renderWithApi(<CloudAccessPanel />, api);
    const dialog = await openConnectToArnStep(user);
    await user.type(within(dialog).getByLabelText("Role ARN"), "arn:aws:iam::123:role/x");
    await user.click(within(dialog).getByRole("button", { name: "Verify" }));

    expect(within(dialog).getByText(/Enter a role ARN like/)).toBeTruthy();
    expect(within(dialog).getByLabelText("Role ARN").getAttribute("aria-invalid")).toBe("true");
    expect(verify).not.toHaveBeenCalled();
  });

  it("continues a pending setup at the role ARN step", async () => {
    const user = userEvent.setup();
    await renderWithApi(
      <CloudAccessPanel />,
      fakeApi((seed) => {
        seed.cloud.push({ ...seed.cloud[0], id: "cc_new", accountId: null, roleArn: null, externalId: "ir-aaaaaaaaaaaa", status: "pending", lastVerifiedAt: null });
      }),
    );
    const card = screen.getByRole("article", { name: "New AWS connection" });
    expect(within(card).getByText("Pending")).toBeTruthy();
    await user.click(within(card).getByRole("button", { name: "Continue setup" }));
    const dialog = screen.getByRole("dialog", { name: "Connect AWS account" });
    expect(within(dialog).getByText("2. Add the role ARN").closest("li")?.getAttribute("aria-current")).toBe("step");
    await user.click(within(dialog).getByRole("button", { name: "Back" }));
    expect(within(dialog).getByText("ir-aaaaaaaaaaaa")).toBeTruthy();
  });

  it("revokes only after typing the exact account ID", async () => {
    const user = userEvent.setup();
    await renderWithApi(<CloudAccessPanel />);
    await user.click(within(screen.getByRole("article", { name: PROD })).getByRole("button", { name: "Revoke" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/stop reading this account immediately/)).toBeTruthy();
    const confirm = within(dialog).getByRole("button", { name: "Revoke access" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    const input = within(dialog).getByRole("textbox");
    await user.type(input, "4123 4567 8901");
    expect(confirm.disabled).toBe(true);
    await user.clear(input);
    await user.type(input, "412345678901");
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);

    expect(screen.queryByRole("dialog")).toBeNull();
    const card = screen.getByRole("article", { name: PROD });
    expect(within(card).getByText("Revoked")).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Remove" })).toBeTruthy();
    expect(within(card).queryByRole("button", { name: "Re-verify" })).toBeNull();
  });

  it("surfaces a revoke error in the dialog", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    api.revokeCloudConnection = () => Promise.reject(new Error("Network down"));
    await renderWithApi(<CloudAccessPanel />, api);
    await user.click(within(screen.getByRole("article", { name: PROD })).getByRole("button", { name: "Revoke" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "412345678901");
    await user.click(within(dialog).getByRole("button", { name: "Revoke access" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe("Network down");
  });

  it("edits regions", async () => {
    const user = userEvent.setup();
    await renderWithApi(<CloudAccessPanel />);
    await user.click(within(screen.getByRole("article", { name: PROD })).getByRole("button", { name: "Edit regions" }));
    const dialog = screen.getByRole("dialog", { name: "Edit regions" });
    await user.click(within(dialog).getByRole("checkbox", { name: /Europe \(Ireland\)/ }));
    await user.click(within(dialog).getByRole("checkbox", { name: /US East \(N\. Virginia\)/ }));
    await user.click(within(dialog).getByRole("button", { name: "Save regions" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    const chips = within(screen.getByRole("article", { name: PROD })).getByRole("list", { name: "Regions" });
    expect(within(chips).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["eu-central-1", "us-east-1"]);
  });

  it("will not save an empty region list", async () => {
    const user = userEvent.setup();
    await renderWithApi(<CloudAccessPanel />);
    await user.click(within(screen.getByRole("article", { name: PROD })).getByRole("button", { name: "Edit regions" }));
    const dialog = screen.getByRole("dialog", { name: "Edit regions" });
    await user.click(within(dialog).getByRole("checkbox", { name: /Frankfurt/ }));
    await user.click(within(dialog).getByRole("checkbox", { name: /Ireland/ }));
    expect((within(dialog).getByRole("button", { name: "Save regions" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).getByText("Pick at least one region.")).toBeTruthy();
  });

  it("rotates the external ID, shows the new trust policy and re-verifies", async () => {
    const user = userEvent.setup();
    await renderWithApi(<CloudAccessPanel />);
    await user.click(within(screen.getByRole("article", { name: PROD })).getByRole("button", { name: "Rotate external ID" }));
    await user.click(within(screen.getByRole("dialog", { name: "Rotate external ID?" })).getByRole("button", { name: "Rotate" }));

    const dialog = await screen.findByRole("dialog", { name: "Update the trust policy" });
    const card = screen.getByRole("article", { name: PROD });
    expect(within(card).getByText("Pending")).toBeTruthy();
    const newId = within(card).getByText(/^ir-[0-9a-f]{12}$/).textContent!;
    expect(newId).not.toBe("ir-7f3c9a2e5b14");
    expect(within(dialog).getByText(new RegExp(`"sts:ExternalId": "${newId}"`))).toBeTruthy();

    await user.click(within(dialog).getByRole("button", { name: "Re-verify" }));
    expect(await within(dialog).findByText(/Verified/)).toBeTruthy();
    expect(within(screen.getByRole("article", { name: PROD })).getByText("Connected")).toBeTruthy();
  });

  it("re-verifies a connected account from its card", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    const verify = vi.spyOn(api, "verifyAwsConnection");
    await renderWithApi(<CloudAccessPanel />, api);
    await user.click(within(screen.getByRole("article", { name: PROD })).getByRole("button", { name: "Re-verify" }));
    expect(verify).toHaveBeenCalledWith("cc_prod", "arn:aws:iam::412345678901:role/InfraredReadOnly");
    expect(await within(screen.getByRole("article", { name: PROD })).findByText("14 Nov, 12:00 UTC")).toBeTruthy();
  });

  it("removes a revoked connection and falls back to the empty state", async () => {
    const user = userEvent.setup();
    await renderWithApi(
      <CloudAccessPanel />,
      fakeApi((seed) => {
        seed.cloud[0].status = "revoked";
      }),
    );
    await user.click(within(screen.getByRole("article", { name: PROD })).getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("No AWS accounts connected")).toBeTruthy();
    expect(screen.queryByRole("article")).toBeNull();
  });
});
