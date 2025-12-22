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
import { Chains } from "../../lib/caip2";
import type { Chain } from "../../lib/caip2";
import { MIN_GAS_AMOUNT, OMNI_BRIDGE_CONTRACT } from "./omni-bridge-constants";
import type { providers } from "near-api-js";
import * as v from "valibot";
import type {
	IntentFtWithdraw,
	IntentStorageDeposit,
} from "@defuse-protocol/contract-types";

export function createWithdrawIntentsPrimitive(params: {
	assetId: string;
	destinationAddress: string;
	amount: bigint;
	nativeFee: bigint;
	storageDepositAmount: bigint;
	omniChainKind: ChainKind;
	intentsContract: string;
	utxoMaxGasFee: bigint | null;
}): (IntentStorageDeposit | IntentFtWithdraw)[] {
	const { contractId: tokenAccountId, standard } = utils.parseDefuseAssetId(
		params.assetId,
	);
	assert(standard === "nep141", "Only NEP-141 is supported");
	const recipient = omniAddress(
		params.omniChainKind,
		params.destinationAddress,
	);
	let msg = "";
	const ftWithdrawPayload: {
		recipient: OmniAddress;
		fee: string;
		native_token_fee: string;
		msg?: string;
	} = {
		recipient,
		fee: "0",
		native_token_fee: params.nativeFee.toString(),
	};
	// For withdrawals to Bitcoin and other UTXO chains we need to specify maxGasFee to the relayer
	// that is picking up our TX and sends it to a connector (btc connector for example).
	// Technically we can avoid specifying it in the message and relayer just takes the same value
	// however this introduces a risk that a malicious actor can pick up this tx and submit it to the connector
	// with a higher max gas fee value that can result in recipient getting less BTC.
	if (isUtxoChain(params.omniChainKind)) {
		assert(
			params.utxoMaxGasFee !== null && params.utxoMaxGasFee > 0n,
			`Invalid utxo max gas fee: expected > 0, got ${params.utxoMaxGasFee}`,
		);
		msg = JSON.stringify({
			MaxGasFee: params.utxoMaxGasFee.toString(),
		});
		ftWithdrawPayload.msg = msg;
	}

	const intents: (IntentStorageDeposit | IntentFtWithdraw)[] = [];
	if (params.nativeFee > 0n) {
		intents.push({
			deposit_for_account_id: calculateStorageAccountId({
				token: `near:${tokenAccountId}`,
				amount: params.amount,
				recipient,
				fee: {
					fee: 0n,
					native_fee: params.nativeFee,
				},
				sender: `near:${params.intentsContract}`,
				msg,
			}),
			amount: params.nativeFee.toString(),
			contract_id: OMNI_BRIDGE_CONTRACT,
			intent: "storage_deposit",
		});
	}
	intents.push({
		intent: "ft_withdraw",
		token: tokenAccountId,
		receiver_id: OMNI_BRIDGE_CONTRACT,
		amount: params.amount.toString(),
		storage_deposit:
			params.storageDepositAmount > 0n
				? params.storageDepositAmount.toString()
				: undefined,
		msg: JSON.stringify(ftWithdrawPayload),
		min_gas: MIN_GAS_AMOUNT,
	});

	return intents;
}

/**
 * Mapping between CAIP-2 chain identifiers and Omni Bridge ChainKind.
 * This serves as a single source of truth for bidirectional chain conversions.
 */
const CHAIN_MAPPINGS: [Chain, ChainKind][] = [
	[Chains.Ethereum, ChainKind.Eth],
	[Chains.Base, ChainKind.Base],
	[Chains.Arbitrum, ChainKind.Arb],
	[Chains.Solana, ChainKind.Sol],
	[Chains.BNB, ChainKind.Bnb],
	[Chains.Bitcoin, ChainKind.Btc],
];

export function caip2ToChainKind(network: Chain): ChainKind | null {
	return CHAIN_MAPPINGS.find(([chain]) => chain === network)?.[1] ?? null;
}

export function chainKindToCaip2(network: ChainKind): Chain | null {
	return CHAIN_MAPPINGS.find(([_, kind]) => kind === network)?.[0] ?? null;
}

const UTXO_CHAINS: ChainKind[] = [ChainKind.Btc];

export function isUtxoChain(network: ChainKind): boolean {
	return UTXO_CHAINS.includes(network);
}

const MIGRATED_POA_TOKEN_CHAIN_KIND_MAPPING = {
	sol: ChainKind.Sol,
};

export function poaContractIdToChainKind(contractId: string): ChainKind {
	for (const [prefix, caip2] of Object.entries(
		MIGRATED_POA_TOKEN_CHAIN_KIND_MAPPING,
	)) {
		if (
			contractId.startsWith(`${prefix}.`) ||
			contractId.startsWith(`${prefix}-`)
		) {
			return caip2;
		}
	}

	throw new Error(`Unsupported Migrated POA token contractId = ${contractId}`);
}

export function isMigratedPoaToken(nearAddress: string) {
	return nearAddress === "sol.omft.near";
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
