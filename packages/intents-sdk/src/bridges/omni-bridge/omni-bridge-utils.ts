import { assert, utils } from "@defuse-protocol/internal-utils";
import {
	ChainKind,
	omniAddress,
	isBridgeToken,
	calculateStorageAccountId,
	type OmniAddress,
	type TokenDecimals,
	getChain,
} from "omni-bridge-sdk";
import type { IntentPrimitive } from "../../intents/shared-types";
import { Chains } from "../../lib/caip2";
import type { Chain } from "../../lib/caip2";
import { OMNI_BRIDGE_CONTRACT } from "./omni-bridge-constants";
import type { providers } from "near-api-js";
import type { CodeResult } from "near-api-js/lib/providers/provider";

export function createWithdrawIntentsPrimitive(params: {
	assetId: string;
	destinationAddress: string;
	amount: bigint;
	nativeFee: bigint;
	storageDepositAmount: bigint;
	omniChainKind: ChainKind;
}): IntentPrimitive[] {
	const { contractId: tokenAccountId, standard } = utils.parseDefuseAssetId(
		params.assetId,
	);
	const recipient = omniAddress(
		params.omniChainKind,
		params.destinationAddress,
	);
	const implicitAccount = calculateStorageAccountId({
		token: `near:${tokenAccountId}`,
		amount: params.amount,
		recipient,
		fee: {
			fee: 0n,
			native_fee: params.nativeFee,
		},
		sender: "near:intents.near",
		msg: "",
	});
	assert(standard === "nep141", "Only NEP-141 is supported");

	return [
		{
			account_id: implicitAccount,
			amount: params.nativeFee.toString(),
			contract_id: OMNI_BRIDGE_CONTRACT,
			intent: "storage_deposit",
		},
		{
			intent: "ft_withdraw",
			token: tokenAccountId,
			receiver_id: OMNI_BRIDGE_CONTRACT,
			amount: params.amount.toString(),
			storage_deposit:
				params.storageDepositAmount > 0n
					? params.storageDepositAmount.toString()
					: null,
			msg: JSON.stringify({
				recipient,
				fee: "0",
				native_token_fee: params.nativeFee.toString(),
			}),
		},
	];
}

export function caip2ToChainKind(network: Chain): ChainKind | null {
	switch (network) {
		case Chains.Ethereum:
			return ChainKind.Eth;
		case Chains.Base:
			return ChainKind.Base;
		case Chains.Arbitrum:
			return ChainKind.Arb;
		case Chains.Solana:
			return ChainKind.Sol;
		// case Chains.Bitcoin:
		// 	return ChainKind.Btc;
		default:
			return null;
	}
}

export function chainKindToCaip2(network: ChainKind): Chain | null {
	switch (network) {
		case ChainKind.Eth:
			return Chains.Ethereum;
		case ChainKind.Base:
			return Chains.Base;
		case ChainKind.Arb:
			return Chains.Arbitrum;
		case ChainKind.Sol:
			return Chains.Solana;
		// case ChainKind.Btc:
		// 	return Chains.Bitcoin;
		default:
			return null;
	}
}

export function validateOmniToken(nearAddress: string): boolean {
	// omni bridge function allows testnet tokens, we should not let them pass since we work only with mainnet ones
	if (nearAddress.endsWith(".testnet")) return false;
	return isBridgeToken(nearAddress);
}

export async function getIntentsOmniStorageBalance(
	nearProvider: providers.Provider,
): Promise<{
	total: string;
	available: string;
}> {
	const storageBalanceRequest = await nearProvider.query<CodeResult>({
		request_type: "call_function",
		account_id: OMNI_BRIDGE_CONTRACT,
		method_name: "storage_balance_of",
		args_base64: Buffer.from(
			JSON.stringify({ account_id: "intents.near" }),
		).toString("base64"),
		finality: "optimistic",
	});

	return JSON.parse(Buffer.from(storageBalanceRequest.result).toString());
}

/**
 * Converts a token address from one chain to its equivalent on another chain.
 * For non-NEAR to non-NEAR conversions, the process goes through NEAR as an intermediary.
 * @param nearProvider near provider used for querying the contract
 * @param tokenAddress The source token address to convert
 * @param destinationChain The target chain for the conversion
 * @returns Promise resolving to the equivalent token address on the destination chain
 * @throws Error if source and destination chains are the same
 *
 * @example
 * // Convert NEAR token to ETH
 * const ethAddress = await getBridgedToken("near:token123", ChainKind.Ethereum)
 *
 * // Convert ETH token to Solana (goes through NEAR)
 * const solAddress = await getBridgedToken("eth:0x123...", ChainKind.Sol)
 */
export async function getBridgedToken(
	nearProvider: providers.Provider,
	tokenAddress: OmniAddress,
	destinationChain: ChainKind,
): Promise<OmniAddress | null> {
	const getBridgedTokenResult = await nearProvider.query<CodeResult>({
		request_type: "call_function",
		account_id: OMNI_BRIDGE_CONTRACT,
		method_name: "get_bridged_token",
		args_base64: Buffer.from(
			JSON.stringify({
				chain: ChainKind[destinationChain].toString(),
				address: tokenAddress,
			}),
		).toString("base64"),
		finality: "optimistic",
	});
	return JSON.parse(Buffer.from(getBridgedTokenResult.result).toString());
}

/**
 * Gets token decimals from the NEAR contract
 * @param nearProvider near provider used for querying the contract
 * @param tokenAddress The Omni token address to check
 * @returns Promise resolving to the token's decimal information
 */
export async function getTokenDecimals(
	nearProvider: providers.Provider,
	tokenAddress: OmniAddress,
): Promise<TokenDecimals> {
	// NEAR tokens don't have decimals stored directly under their NEAR addresses
	// Instead, decimals are stored under their foreign chain representations
	//
	// For example:
	// - USDC on NEAR → ETH might use 6 decimals
	// - USDC on NEAR → Solana might use 9 decimals
	// - USDC on NEAR → BSC might use 18 decimals
	//
	// So querying "near:usdc.testnet" will not work
	const chain = getChain(tokenAddress);
	if (chain === ChainKind.Near) {
		throw new Error(
			"Token decimals cannot be queried using NEAR addresses. Use the token's foreign chain representation (e.g., eth:0x...) to query decimals.",
		);
	}

	const getTokenDecimalsResult = await nearProvider.query<CodeResult>({
		request_type: "call_function",
		account_id: OMNI_BRIDGE_CONTRACT,
		method_name: "get_token_decimals",
		args_base64: Buffer.from(
			JSON.stringify({
				address: tokenAddress,
			}),
		).toString("base64"),
		finality: "optimistic",
	});

	return JSON.parse(Buffer.from(getTokenDecimalsResult.result).toString());
}
