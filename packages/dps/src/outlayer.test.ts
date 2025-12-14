import { describe, expect, it } from "vitest";
import { Outlayer } from "./outlayer";

// Requires a link to the executable
describe("Outlayer", () => {
	describe("send()", () => {
		it("Should get the initialization response", async () => {
			const outlayer = new Outlayer();
			const message = "0x000000000100000000";

			const result = await outlayer.send({ message });
			const expected =
				"0x00000000010000000002b9c6c70ef6fd3cd22925de22eb8a76db882af0754b8dc57eafaf6fa40dbb4abd9c90dcfd2d58e76ea7cbb29ee5345f7adbd264c6f5f741c285dd98c43f62358e";

			expect(result).toEqual(expected);
		});
	});
});
