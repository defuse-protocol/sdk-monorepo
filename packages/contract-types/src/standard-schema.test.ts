import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { MultiPayloadNarrowedValidator } from "./validate.js";

// ========== EXAMPLE: Using with Hono ==========
// import { Hono } from "hono";
// import { sValidator } from "@hono/standard-validator";
// import { MultiPayloadNarrowedValidator } from "@defuse-protocol/contract-types/validate";
//
// const app = new Hono();
// app.post("/intent", sValidator("json", MultiPayloadNarrowedValidator), (c) => {
//   const payload = c.req.valid("json");
//   return c.json({ success: true, standard: payload.standard });
// });
// ===============================================

const validPayload = {
	standard: "erc191" as const,
	payload: JSON.stringify({
		deadline: "2025-12-31T23:59:59Z",
		nonce: "abc123",
		signer_id: "bob.near",
		verifying_contract: "defuse.near",
		intents: [{ intent: "transfer", receiver_id: "alice.near", tokens: {} }],
	}),
};

describe("Standard Schema compliance with Hono", () => {
	const app = new Hono();
	app.post(
		"/intent",
		sValidator("json", MultiPayloadNarrowedValidator),
		(c) => {
			const payload = c.req.valid("json");
			return c.json({ success: true, standard: payload.standard });
		},
	);

	it("validates valid payload", async () => {
		const res = await app.request("/intent", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(validPayload),
		});

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.standard).toBe("erc191");
	});

	it("rejects invalid payload with 400 status", async () => {
		const invalidPayload = {
			standard: "erc191",
			payload: "not valid json",
		};

		const res = await app.request("/intent", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(invalidPayload),
		});

		expect(res.status).toBe(400);
	});

	it("rejects malformed JSON with 400 status", async () => {
		const res = await app.request("/intent", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "not json at all",
		});

		expect(res.status).toBe(400);
	});
});
