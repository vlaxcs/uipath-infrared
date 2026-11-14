import { describe, expect, it } from "vitest";
import { sampleRun } from "~/runs/sampleRun";
import { groupEventsByRevision } from "~/runs/timelineGroups";

describe("grouping events by revision", () => {
  it("splits the sample into its initial pass and one revision", () => {
    const groups = groupEventsByRevision(sampleRun.events);
    expect(groups.map((group) => group.label)).toEqual(["Initial pass", "Revision 1"]);
    expect(groups[0].events).toHaveLength(8);
    expect(groups[1].events).toHaveLength(13);
  });

  it("keeps events in seq order even when they share a timestamp", () => {
    const revision = groupEventsByRevision(sampleRun.events)[1].events;
    const sixteen = revision.findIndex((event) => event.seq === 16);
    const seventeen = revision.findIndex((event) => event.seq === 17);
    expect(sixteen).toBeLessThan(seventeen);
  });

  it("sorts shuffled input", () => {
    const groups = groupEventsByRevision([...sampleRun.events].reverse());
    expect(groups[0].events.map((event) => event.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
