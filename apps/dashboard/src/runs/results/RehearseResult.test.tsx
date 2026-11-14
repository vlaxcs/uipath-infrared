import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import rehearsal from "../../../../../contracts/rehearsal.example.json";
import { RehearseResult } from "~/runs/results/RehearseResult";

afterEach(cleanup);

describe("the rehearsal result", () => {
  it("shows the verdict, the injected failure, the phases and the components", () => {
    render(<RehearseResult value={rehearsal} />);

    expect(screen.getByText("Passed")).toBeTruthy();
    expect(screen.getByText("99.94%")).toBeTruthy();
    expect(screen.getByText("99.9%")).toBeTruthy();
    expect(screen.getByText("rightsize_in_place")).toBeTruthy();
    expect(screen.getByText("instance_stop on vm-shop-web-1 for 20s")).toBeTruthy();
    expect(screen.getByText("baseline")).toBeTruthy();
    expect(screen.getByText("recovery")).toBeTruthy();
    expect(screen.getByText("vm-shop-web-1")).toBeTruthy();
    expect(screen.getAllByText("healthy").length).toBeGreaterThan(0);
    expect(screen.getAllByText("failed").length).toBeGreaterThan(0);
  });
});
