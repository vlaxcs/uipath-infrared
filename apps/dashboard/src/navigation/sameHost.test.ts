import { describe, expect, it } from "vitest";
import { sameHostUrl } from "~/navigation/sameHost";

describe("the dashboard and the orchestrator on one host", () => {
  it("moves a localhost page to the orchestrator's 127.0.0.1, keeping the path and the route", () => {
    expect(sameHostUrl("http://localhost:5173/app/?login_error=state#/login", "http://127.0.0.1:8091")).toBe(
      "http://127.0.0.1:5173/app/?login_error=state#/login",
    );
  });

  it("leaves a page already on the orchestrator's host alone", () => {
    expect(sameHostUrl("http://127.0.0.1:5173/app/", "http://127.0.0.1:8091")).toBeNull();
  });

  it("never moves a page off a real domain", () => {
    expect(sameHostUrl("https://app.infrared.example/app/", "https://api.infrared.example")).toBeNull();
    expect(sameHostUrl("http://localhost:5173/app/", "https://api.infrared.example")).toBeNull();
  });

  it("does nothing without an orchestrator or with a bad URL", () => {
    expect(sameHostUrl("http://localhost:5173/app/", null)).toBeNull();
    expect(sameHostUrl("http://localhost:5173/app/", "not a url")).toBeNull();
  });
});
