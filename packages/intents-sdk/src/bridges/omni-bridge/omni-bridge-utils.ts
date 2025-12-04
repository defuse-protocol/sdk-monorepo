import { assert, utils } from "@defuse-protocol/internal-utils";
import type { IntentPrimitive } from "../../intents/shared-types";
import { Chains } from "../../lib/caip2";
import type { Chain } from "../../lib/caip2";
import { OMNI_BRIDGE_CONTRACT } from "./omni-bridge-constants";
import type { providers } from "near-api-js";
import * as v from "valibot";
import type { ChainPrefix, EVMChainKind } from "./omni-bridge-types";
import {
	ChainKind,
	type OmniAddress,
	type TokenDecimals,
} from "./omni-bridge-types";
import { b } from "@zorsh/zorsh";
import { hex, base58 } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2";

export function createWithdrawIntentsPrimitive(params: {
	assetId: string;
	destinationAddress: string;
	amount: bigint;
	nativeFee: bigint;
	storageDepositAmount: bigint;
	omniChainKind: ChainKind;
	intentsContract: string;
	utxoMaxGasFee: bigint | null;
}): IntentPrimitive[] {
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

	const intents: IntentPrimitive[] = [];
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

/**
 * Validates if a NEAR address is a recognized omni bridge token
 * @param nearAddress - The NEAR address to validate
 * @returns true if the address follows a known omni bridge pattern
 *
 * @example
 * isBridgeToken("foo.omdep.near") // false
 * isBridgeToken("sol-ABC123.omdep.near") // true
 * isBridgeToken("random.near") // false
 */
export function isBridgeToken(nearAddress: string): boolean {
	return (
		nearAddress in CHAIN_PATTERNS ||
		/\.(omdep\.near|omnidep\.testnet|factory\.bridge\.(near|testnet))$/.test(
			nearAddress,
		)
	);
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

// Helper function to construct OmniAddress
export const omniAddress = (chain: ChainKind, address: string): OmniAddress => {
	const prefix = ChainKind[chain].toLowerCase() as ChainPrefix;
	return `${prefix}:${address}`;
};

/**
 * Transfer message type for storage account calculation
 */
export type TransferMessageForStorage = {
	token: string;
	amount: bigint;
	recipient: string;
	fee: {
		fee: bigint;
		native_fee: bigint;
	};
	sender: string;
	msg: string;
};
type AccountId = string;

function parseOmniAddress(token: string) {
	const parts = token.split(":", 2);
	const chain = parts[0];
	const address = parts[1];
	if (!address) {
		throw new Error(`Invalid token address format: ${token}`);
	}
	const decodeHex = (addr: string) => Array.from(hex.decode(addr.slice(2)));
	const decodeBase58 = (addr: string) => Array.from(base58.decode(addr));

	switch (chain) {
		case "eth":
			return { Eth: decodeHex(address) };
		case "near":
			return { Near: address };
		case "sol":
			return { Sol: decodeBase58(address) };
		case "arb":
			return { Arb: decodeHex(address) };
		case "base":
			return { Base: decodeHex(address) };
		case "bnb":
			return { Bnb: decodeHex(address) };
		case "btc":
			return { Btc: address };
		case "zcash":
			return { Zcash: address };
		default:
			throw new Error(`Unknown chain: ${chain}`);
	}
}

const OmniAddressSchemaForTransferMessage = b.enum({
	Eth: b.array(b.u8(), 20),
	Near: b.string(),
	Sol: b.array(b.u8(), 32),
	Arb: b.array(b.u8(), 20),
	Base: b.array(b.u8(), 20),
	Bnb: b.array(b.u8(), 20),
	Btc: b.string(),
	Zcash: b.string(),
});

/**
 * Borsh schema for TransferMessageStorageAccount
 * This matches the exact field order and types from the Rust implementation
 */
const TransferMessageStorageAccountSchema = b.struct({
	token: OmniAddressSchemaForTransferMessage,
	amount: b.u128(),
	recipient: OmniAddressSchemaForTransferMessage,
	fee: b.struct({
		fee: b.u128(),
		native_fee: b.u128(),
	}),
	sender: OmniAddressSchemaForTransferMessage,
	msg: b.string(),
});
/**
 * Calculates the storage account ID for a transfer message
 *
 * This function replicates the Rust implementation:
 * 1. Serializes the transfer message using Borsh
 * 2. Hashes the serialized data with SHA256
 * 3. Converts the hash to hex to create an implicit NEAR account ID
 *
 * @param transferMessage - The transfer message data with bigint amounts
 * @returns The calculated storage account ID as a hex string
 */
export function calculateStorageAccountId(
	transferMessage: TransferMessageForStorage,
): AccountId {
	const serializedData = TransferMessageStorageAccountSchema.serialize({
		token: parseOmniAddress(transferMessage.token),
		amount: transferMessage.amount,
		recipient: parseOmniAddress(transferMessage.recipient),
		fee: {
			fee: transferMessage.fee.fee,
			native_fee: transferMessage.fee.native_fee,
		},
		sender: parseOmniAddress(transferMessage.sender),
		msg: transferMessage.msg,
	});

	const hash = sha256(serializedData);
	return hex.encode(hash);
}

// Extract chain from omni address
export const getChain = (addr: OmniAddress): ChainKind => {
	const prefix = addr.split(":")[0] as ChainPrefix;

	const chainMapping = {
		eth: ChainKind.Eth,
		near: ChainKind.Near,
		sol: ChainKind.Sol,
		arb: ChainKind.Arb,
		base: ChainKind.Base,
		bnb: ChainKind.Bnb,
		btc: ChainKind.Btc,
		zec: ChainKind.Zcash,
	} as const;

	return chainMapping[prefix];
};

const CHAIN_PATTERNS: Record<string, ChainKind> = {
	"nbtc.bridge.near": ChainKind.Btc,
	"eth.bridge.near": ChainKind.Eth,
	"sol.omdep.near": ChainKind.Sol,
	"base.omdep.near": ChainKind.Base,
	"arb.omdep.near": ChainKind.Arb,
	"bnb.omdep.near": ChainKind.Bnb,
};

/**
 * Parses the origin chain from a NEAR token address format (offline parsing)
 *
 * @param nearAddress - The NEAR token address (e.g., "sol-3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG.omdep.near")
 * @returns The origin chain kind, or null if pattern is not recognized
 */
export function parseOriginChain(nearAddress: string): ChainKind | null {
	// Check exact matches
	const exactMatch = CHAIN_PATTERNS[nearAddress];
	if (exactMatch !== undefined) return exactMatch;

	// Check prefixed patterns
	if (
		/\.(omdep\.near|omnidep\.testnet|factory\.bridge\.(near|testnet))$/.test(
			nearAddress,
		)
	) {
		if (nearAddress.startsWith("sol-")) return ChainKind.Sol;
		if (nearAddress.startsWith("base-")) return ChainKind.Base;
		if (nearAddress.startsWith("arb-")) return ChainKind.Arb;
		if (nearAddress.startsWith("bnb-")) return ChainKind.Bnb;
		if (nearAddress.includes("factory.bridge")) return ChainKind.Eth;
	}

	return null;
}

/**
 * Checks if a given chain is an EVM-compatible chain
 * @param chain - The chain to check
 * @returns true if the chain is EVM-compatible, false otherwise
 */
export function isEvmChain(chain: ChainKind): chain is EVMChainKind {
	return (
		chain === ChainKind.Eth ||
		chain === ChainKind.Base ||
		chain === ChainKind.Arb ||
		chain === ChainKind.Bnb
	);
}

/**
 * Gets the minimum transferable amount for a token pair accounting for decimal normalization
 * @param originDecimals The decimals of the source token
 * @param destinationDecimals The decimals of the destination token
 * @returns The minimum transferable amount as a bigint
 */
export function getMinimumTransferableAmount(
	originDecimals: number,
	destinationDecimals: number,
): bigint {
	// Start with 1 in destination decimal system
	let minAmount = 1n;

	// If origin has more decimals, we need to scale up
	if (originDecimals > destinationDecimals) {
		minAmount = minAmount * 10n ** BigInt(originDecimals - destinationDecimals);
	}

	return minAmount;
}

/**
 * Normalizes an amount from one decimal precision to another using BigInt math
 * @param amount The amount to normalize as a bigint
 * @param fromDecimals The source decimal precision
 * @param toDecimals The target decimal precision
 * @returns The normalized amount as a bigint
 */
export function normalizeAmount(
	amount: bigint,
	fromDecimals: number,
	toDecimals: number,
): bigint {
	if (fromDecimals === toDecimals) return amount;

	if (fromDecimals > toDecimals) {
		// Scale down: Divide by power of 10
		const scale = 10n ** BigInt(fromDecimals - toDecimals);
		return amount / scale;
	} else {
		// Scale up: Multiply by power of 10
		const scale = 10n ** BigInt(toDecimals - fromDecimals);
		return amount * scale;
	}
}

/**
 * Verifies if a transfer amount will be valid after normalization
 * @param amount The amount to transfer
 * @param fee The fee to be deducted
 * @param originDecimals The decimals of the token on the source chain
 * @param destinationDecimals The decimals of the token on the destination chain
 * @returns true if the normalized amount (minus fee) will be greater than 0
 */
export function verifyTransferAmount(
	amount: bigint,
	fee: bigint,
	originDecimals: number,
	destinationDecimals: number,
): boolean {
	try {
		// Use the minimum of origin and destination decimals for normalization
		const minDecimals = Math.min(originDecimals, destinationDecimals);

		// First normalize amount minus fee to the minimum decimals
		const normalizedAmount = normalizeAmount(
			amount - fee,
			originDecimals,
			minDecimals,
		);

		// Check if amount minus fee is greater than 0
		return normalizedAmount > 0n;
	} catch {
		// If we hit any math errors, the amount is effectively too small
		return false;
	}
}
