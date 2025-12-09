import { beforeEach, describe, expect, test, vi } from "vitest";
import { RpcRequestError } from "../errors/request";
import {
	PoaWithdrawalNotFoundError,
	PoaWithdrawalPendingError,
} from "./errors/withdrawal";
import { getWithdrawalStatus } from "./poaBridgeHttpClient";
import {
	waitForWithdrawalCompletion,
	type WithdrawalCriteria,
} from "./waitForWithdrawalCompletion";

vi.mock("./poaBridgeHttpClient");

const testCriteria: WithdrawalCriteria = {
	assetId: "nep141:usdc.token.near",
};

const ok = {
	withdrawals: [
		{
			status: "COMPLETED",
			data: {
				transfer_tx_hash: "0xfoo",
				chain: "near:mainnet",
				near_token_id: "usdc.token.near",
			},
		},
	],
};
const pending = {
	withdrawals: [
		{
			status: "PENDING",
			data: {
				near_token_id: "usdc.token.near",
			},
		},
	],
};
const notFound = new RpcRequestError({
	body: {},
	error: { code: 0, message: "Withdrawals not found" },
	url: "",
});
const forbidden = new RpcRequestError({
	body: {},
	error: { code: 403, message: "Forbidden" },
	url: "",
});

describe("waitForWithdrawalCompletion()", () => {
	beforeEach(() => {
		vi.mocked(getWithdrawalStatus).mockReset();
	});

	test("withdrawal found", async () => {
		// @ts-expect-error mock contains only fields needed for test
		vi.mocked(getWithdrawalStatus).mockResolvedValueOnce(ok);

		const p = waitForWithdrawalCompletion({
			txHash: "foo",
			withdrawalCriteria: testCriteria,
			signal: new AbortController().signal,
		});

		await expect(p).resolves.toEqual({
			destinationTxHash: "0xfoo",
			chain: "near:mainnet",
		});
		expect(getWithdrawalStatus).toHaveBeenCalledTimes(1);
	});

	test("withdrawal not found", async () => {
		vi.mocked(getWithdrawalStatus).mockRejectedValueOnce(notFound);

		const p = waitForWithdrawalCompletion({
			txHash: "foo",
			withdrawalCriteria: testCriteria,
			signal: new AbortController().signal,
			retryOptions: { maxAttempts: 1 },
		});

		await expect(p).rejects.toBeInstanceOf(PoaWithdrawalNotFoundError);
		expect(getWithdrawalStatus).toHaveBeenCalledTimes(1);
	});

	test("complete on second try", async () => {
		vi.mocked(getWithdrawalStatus)
			.mockRejectedValueOnce(forbidden)
			.mockRejectedValueOnce(notFound)
			// @ts-expect-error mock contains only fields needed for test
			.mockResolvedValueOnce(pending)
			// @ts-expect-error mock contains only fields needed for test
			.mockResolvedValueOnce(ok);

		const p = waitForWithdrawalCompletion({
			txHash: "foo",
			withdrawalCriteria: testCriteria,
			signal: new AbortController().signal,
			retryOptions: { maxAttempts: 4 },
		});

		await expect(p).resolves.toEqual({
			destinationTxHash: "0xfoo",
			chain: "near:mainnet",
		});
		expect(getWithdrawalStatus).toHaveBeenCalledTimes(4);
	});

	test("crash", async () => {
		const err = new Error("dummy");
		vi.mocked(getWithdrawalStatus).mockRejectedValueOnce(err);

		const p = waitForWithdrawalCompletion({
			txHash: "foo",
			withdrawalCriteria: testCriteria,
			signal: new AbortController().signal,
			retryOptions: { maxAttempts: 1000 },
		});

		await expect(p).rejects.toBe(err);
		expect(getWithdrawalStatus).toHaveBeenCalledTimes(1);
	});

	test("pending", async () => {
		// @ts-expect-error mock contains only fields needed for test
		vi.mocked(getWithdrawalStatus).mockResolvedValueOnce(pending);

		const p = waitForWithdrawalCompletion({
			txHash: "foo",
			withdrawalCriteria: testCriteria,
			signal: new AbortController().signal,
			retryOptions: { maxAttempts: 1 },
		});

		await expect(p).rejects.toBeInstanceOf(PoaWithdrawalPendingError);
		expect(getWithdrawalStatus).toHaveBeenCalledTimes(1);
	});

	test("matches withdrawal by criteria when multiple withdrawals exist", async () => {
		const multipleWithdrawals = {
			withdrawals: [
				{
					status: "COMPLETED",
					data: {
						transfer_tx_hash: "0xother",
						chain: "eth:1",
						near_token_id: "other.token.near",
					},
				},
				{
					status: "COMPLETED",
					data: {
						transfer_tx_hash: "0xmatched",
						chain: "near:mainnet",
						near_token_id: "usdc.token.near",
					},
				},
			],
		};
		// @ts-expect-error mock contains only fields needed for test
		vi.mocked(getWithdrawalStatus).mockResolvedValueOnce(multipleWithdrawals);

		const p = waitForWithdrawalCompletion({
			txHash: "foo",
			withdrawalCriteria: testCriteria,
			signal: new AbortController().signal,
		});

		await expect(p).resolves.toEqual({
			destinationTxHash: "0xmatched",
			chain: "near:mainnet",
		});
	});
});
