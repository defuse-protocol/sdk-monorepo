import { describe, expect, it } from "vitest";
import { tronAddressToHex } from "./tronAddressToHex.js";

describe("tronAddressToHex", () => {
	it("should convert Tron address to hex", () => {
		expect(tronAddressToHex("TQuJ8ERX699UDtQkRPDNQh7H3RviPYszgS")).toBe(
			"41a3cc7ffc0694cb8dc63a9c595886ec2c179caa2e",
		);
	});
});
