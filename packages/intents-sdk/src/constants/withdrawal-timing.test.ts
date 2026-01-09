import { describe, expect, it } from "vitest";
import { getWithdrawalStatsForChain } from "./withdrawal-timing";
import { RouteEnum } from "./route-enum";

describe("getWithdrawalStatsForChain", () => {
	it("returns 3x p99 as timeout for known chain", () => {
		// optimism has p99 = 23 seconds
		const stats = getWithdrawalStatsForChain({ chain: "eip155:10" });

		expect(stats.p99).toBe(23 * 1000 * 3); // 69 seconds
	});

	it("adds extra 12 minutes for HOT bridge", () => {
		const statsWithoutHot = getWithdrawalStatsForChain({ chain: "eip155:10" });
		const statsWithHot = getWithdrawalStatsForChain({
			chain: "eip155:10",
			bridgeRoute: RouteEnum.HotBridge,
		});

		const extraMs = 12 * 60 * 1000;
		expect(statsWithHot.p99).toBe(statsWithoutHot.p99 + extraMs);
	});

	it("returns default stats for unknown chain", () => {
		const stats = getWithdrawalStatsForChain({
			chain: "unknown:chain" as never,
		});

		expect(stats.p50).toBe(60_000);
		expect(stats.p90).toBe(600_000);
		expect(stats.p99).toBe(21_600_000); // 6 hours (3x 2-hour)
	});

	it("adds extra 12 minutes to default stats for HOT bridge", () => {
		const stats = getWithdrawalStatsForChain({
			chain: "unknown:chain" as never,
			bridgeRoute: RouteEnum.HotBridge,
		});

		const extraMs = 12 * 60 * 1000;
		expect(stats.p99).toBe(21_600_000 + extraMs);
	});

	it("does not add extra time for non-HOT bridges", () => {
		const statsNoRoute = getWithdrawalStatsForChain({ chain: "eip155:10" });
		const statsPoaBridge = getWithdrawalStatsForChain({
			chain: "eip155:10",
			bridgeRoute: RouteEnum.PoaBridge,
		});

		expect(statsPoaBridge.p99).toBe(statsNoRoute.p99);
	});
});
