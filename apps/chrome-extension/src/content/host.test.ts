import { afterEach, describe, expect, it } from "vitest";
import { ensureHost, HOST_ID } from "~/content/host";

afterEach(() => {
  document.getElementById(HOST_ID)?.remove();
});

describe("the content host", () => {
  it("mounts once per document and returns its shadow root", () => {
    const first = ensureHost(document);
    expect(first).not.toBeNull();

    const second = ensureHost(document);
    expect(second).toBeNull();

    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1);
    expect(document.getElementById(HOST_ID)?.shadowRoot).toBe(first);
  });
});
