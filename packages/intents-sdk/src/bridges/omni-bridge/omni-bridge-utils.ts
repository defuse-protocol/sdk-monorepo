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
import * as v from "valibot";

export function createWithdrawIntentsPrimitive(params: {
	assetId: string;
	destinationAddress: string;
	amount: bigint;
	nativeFee: bigint;
	storageDepositAmount: bigint;
	omniChainKind: ChainKind;
	intentsContract: string;
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
		sender: `near:${params.intentsContract}`,
		msg: "",
	});
	assert(standard === "nep141", "Only NEP-141 is supported");

	return [
		{
			deposit_for_account_id: implicitAccount,
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
					: undefined,
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
		case Chains.BNB:
			return ChainKind.Bnb;
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
		case ChainKind.Bnb:
			return Chains.BNB;
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

export async function getAccountOmniStorageBalance(
	nearProvider: providers.Provider,
	accountId: string,
): Promise<{
	total: string;
	available: string;
} | null> {
	return utils.queryContract({
		contractId: OMNI_BRIDGE_CONTRACT,
		methodName: "storage_balance_of",
		args: { account_id: accountId },
		finality: "optimistic",
		nearClient: nearProvider,
		schema: v.union([
			v.null(),
			v.object({ total: v.string(), available: v.string() }),
		]),
	});
}

const OmniAddressSchema = v.custom<OmniAddress>(
	(input): input is OmniAddress =>
		typeof input === "string" &&
		(input.startsWith("eth:") ||
			input.startsWith("near:") ||
			input.startsWith("sol:") ||
			input.startsWith("arb:") ||
			input.startsWith("base:") ||
			input.startsWith("btc:") ||
			input.startsWith("bnb:")),
	"Must comply with omni address schema",
);
/**
 * Converts a token address from one chain to its equivalent on another chain.
 * @param nearProvider Near provider used for querying the contract
 * @param tokenAddress The source token address to convert
 * @param destinationChain The target chain for the conversion
 * @returns Promise resolving to the equivalent token address on the destination chain
 * @throws Error if source and destination chains are the same
 *
 * @example
 * // Convert NEAR token to ETH
 * const ethAddress = await getBridgedToken("near:token123", ChainKind.Ethereum)
 */
export async function getBridgedToken(
	nearProvider: providers.Provider,
	tokenAddress: OmniAddress,
	destinationChain: ChainKind,
): Promise<OmniAddress | null> {
	return utils.queryContract({
		contractId: OMNI_BRIDGE_CONTRACT,
		methodName: "get_bridged_token",
		args: {
			chain: ChainKind[destinationChain].toString(),
			address: tokenAddress,
		},
		finality: "optimistic",
		nearClient: nearProvider,
		schema: v.union([v.null(), OmniAddressSchema]),
	});
}

/**
 * Gets token decimals from the NEAR contract
 * @param nearProvider Near provider used for querying the contract
 * @param tokenAddress The Omni token address to check
 * @returns Promise resolving to the token's decimal information
 */
export async function getTokenDecimals(
	nearProvider: providers.Provider,
	tokenAddress: OmniAddress,
): Promise<TokenDecimals | null> {
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

	return utils.queryContract({
		contractId: OMNI_BRIDGE_CONTRACT,
		methodName: "get_token_decimals",
		args: { address: tokenAddress },
		finality: "optimistic",
		nearClient: nearProvider,
		schema: v.union([
			v.null(),
			v.object({ decimals: v.number(), origin_decimals: v.number() }),
		]),
	});
}
