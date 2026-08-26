import { utils } from "@defuse-protocol/internal-utils";
import {
	ChainKind,
	isBridgeToken,
	type OmniAddress,
	type TokenDecimals,
	getChain,
} from "@omni-bridge/core";
import { Chains } from "../../lib/caip2";
import type { Chain } from "../../lib/caip2";
import { MIN_GAS_AMOUNT, OMNI_BRIDGE_CONTRACT } from "./omni-bridge-constants";
import type { providers } from "near-api-js";
import * as v from "valibot";
import type {
	IntentFtWithdraw,
	IntentStorageDeposit,
} from "@defuse-protocol/contract-types";
import { POA_TOKENS_MIGRATED_TO_OMNI_BRIDGE } from "../../constants/poa-tokens-migrated-to-omni-bridge";
import type { OmniWithdrawIntentParams } from "./omni-withdraw-params";

/**
 * Lays a calculated withdrawal out as intents.
 *
 * It takes the result of `deriveOmniWithdrawIntentParams` rather than the inputs to it, so
 * there is one calculation and no way to hand it a value that was worked out some other way.
 * That matters most for the amount: a UTXO chain has already added its fees to it, and doing
 * that twice would send more than the caller asked for.
 */
export function createWithdrawIntentsPrimitive({
	tokenAccountId,
	recipient,
	msg,
	externalId,
	storageDepositAccountId,
	amount,
	nativeFee,
	storageDepositAmount,
}: OmniWithdrawIntentParams): (IntentStorageDeposit | IntentFtWithdraw)[] {
	const ftWithdrawPayload: {
		recipient: OmniAddress;
		fee: string;
		native_token_fee: string;
		external_id: string;
		msg?: string;
	} = {
		recipient,
		fee: "0",
		native_token_fee: nativeFee.toString(),
		external_id: externalId,
	};
	if (msg !== "") {
		ftWithdrawPayload.msg = msg;
	}

	const intents: (IntentStorageDeposit | IntentFtWithdraw)[] = [];
	if (storageDepositAccountId !== null) {
		intents.push({
			deposit_for_account_id: storageDepositAccountId,
			amount: nativeFee.toString(),
			contract_id: OMNI_BRIDGE_CONTRACT,
			intent: "storage_deposit",
		});
	}
	intents.push({
		intent: "ft_withdraw",
		token: tokenAccountId,
		receiver_id: OMNI_BRIDGE_CONTRACT,
		amount: amount.toString(),
		storage_deposit:
			storageDepositAmount > 0n ? storageDepositAmount.toString() : undefined,
		msg: JSON.stringify(ftWithdrawPayload),
		min_gas: MIN_GAS_AMOUNT,
	});

	return intents;
}

/**
 * Mapping between CAIP-2 chain identifiers and Omni Bridge ChainKind.
 * This serves as a single source of truth for bidirectional chain conversions.
 */
export const CHAIN_MAPPINGS: [Chain, ChainKind][] = [
	[Chains.Ethereum, ChainKind.Eth],
	[Chains.Base, ChainKind.Base],
	[Chains.Arbitrum, ChainKind.Arb],
	[Chains.Solana, ChainKind.Sol],
	[Chains.BNB, ChainKind.Bnb],
	[Chains.Bitcoin, ChainKind.Btc],
	[Chains.Abstract, ChainKind.Abs],
	[Chains.Starknet, ChainKind.Strk],
	[Chains.Fogo, ChainKind.Fogo],
	[Chains.Polygon, ChainKind.Pol],
	[Chains.Aptos, ChainKind.Aptos],
	[Chains.HyperEvm, ChainKind.HlEvm],
];

export function chainKindToCaip2(network: ChainKind): Chain | null {
	return CHAIN_MAPPINGS.find(([_, kind]) => kind === network)?.[0] ?? null;
}

export function poaContractIdToChainKind(contractId: string): ChainKind | null {
	return POA_TOKENS_MIGRATED_TO_OMNI_BRIDGE[contractId] ?? null;
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
			input.startsWith("bnb:") ||
			input.startsWith("abs:") ||
			input.startsWith("strk:") ||
			input.startsWith("fogo:") ||
			input.startsWith("pol:") ||
			input.startsWith("aptos:") ||
			input.startsWith("hlevm:")),
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
