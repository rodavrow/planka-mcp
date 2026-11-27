/**
 * Regression: PLANKA 2.0 does not include comments in GET /api/cards/:id.
 * They must be fetched from GET /api/cards/:id/comments, paginated with ?beforeId=.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock("../../src/client.js", () => ({ plankaClient: { get: getMock } }));

import { getCommentsForCard } from "../../src/operations/comments.js";
import { getCard } from "../../src/operations/cards.js";

function comment(id: string, createdAt: string) {
  return { id, cardId: "c1", userId: "u1", text: `text ${id}`, createdAt, updatedAt: null };
}

const CARD = {
  id: "c1",
  boardId: "b1",
  listId: "l1",
  name: "Card",
  position: 1,
  type: "project",
  createdAt: "2024-01-01T00:00:00.000Z",
};

function routeComments(pages: Record<string, unknown[]>) {
  getMock.mockImplementation(async (path: string) => {
    if (path === "/api/cards/c1") return { item: CARD, included: {} };
    const match = /^\/api\/cards\/c1\/comments(?:\?beforeId=(\d+))?$/.exec(path);
    if (!match) throw new Error(`unexpected path ${path}`);
    return { items: pages[match[1] ?? "first"] ?? [], included: { users: [] } };
  });
}

beforeEach(() => {
  getMock.mockReset();
});

describe("getCommentsForCard", () => {
  it("returns comments from the card comments endpoint", async () => {
    routeComments({ first: [comment("2", "2024-01-02T00:00:00.000Z")] });

    const comments = await getCommentsForCard("c1");

    expect(comments.map((c) => c.id)).toEqual(["2"]);
  });

  it("follows beforeId pagination until an empty page", async () => {
    routeComments({
      first: [comment("30", "2024-01-03T00:00:00.000Z"), comment("20", "2024-01-02T00:00:00.000Z")],
      "20": [comment("10", "2024-01-01T00:00:00.000Z")],
    });

    const comments = await getCommentsForCard("c1");

    expect(comments.map((c) => c.id)).toEqual(["30", "20", "10"]);
  });

  it("returns an empty list for a card without comments", async () => {
    routeComments({});

    expect(await getCommentsForCard("c1")).toEqual([]);
  });

  it("fails instead of looping when the server repeats a page", async () => {
    getMock.mockResolvedValue({ items: [comment("5", "2024-01-01T00:00:00.000Z")] });

    await expect(getCommentsForCard("c1")).rejects.toThrow(/pagination/i);
  });
});

describe("getCard", () => {
  it("includes comments fetched from the comments endpoint", async () => {
    routeComments({ first: [comment("7", "2024-01-02T00:00:00.000Z")] });

    const details = await getCard("c1");

    expect(details.comments.map((c) => c.id)).toEqual(["7"]);
  });
});
