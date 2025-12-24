import { describe, expect, it } from "vitest";
import { commitmentSample } from "./data/commitment-samples";
import { EvmCommitmentParameters } from "./data/evm-params";

describe("EvmCommitmentParameters tests", () => {
	describe("parse()", () => {
		it("Should parse the serialized data correctly", () => {
			const result = EvmCommitmentParameters.parse(commitmentSample);
			expect(result).toBeInstanceOf(EvmCommitmentParameters);
			expect(result).toHaveProperty(
				"refundTo",
				"0xcef67989ae740cc9c92fa7385f003f84eaafd915",
			);
			expect(result).toHaveProperty("permittedOps");
			expect(result).toHaveProperty("extraData", "substance-test-1.near");
		});
	});
});
