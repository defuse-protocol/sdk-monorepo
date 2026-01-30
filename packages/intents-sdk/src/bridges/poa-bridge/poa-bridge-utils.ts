import { type poaBridge, utils } from "@defuse-protocol/internal-utils";
import type { IntentPrimitive } from "../../intents/shared-types";
import { type Chain, Chains } from "../../lib/caip2";
import { MIN_GAS_AMOUNT } from "./poa-constants";

export function createWithdrawIntentPrimitive(params: {
	assetId: string;
	destinationAddress: string;
	destinationMemo: string | undefined;
	amount: bigint;
}): Extract<IntentPrimitive, { intent: "ft_withdraw" }> {
	const { contractId: tokenAccountId } = utils.parseDefuseAssetId(
		params.assetId,
	);
	return {
		intent: "ft_withdraw",
		token: tokenAccountId,
		receiver_id: tokenAccountId,
		amount: params.amount.toString(),
		memo: createWithdrawMemo({
			receiverAddress: params.destinationAddress,
			xrpMemo: params.destinationMemo,
		}),
		min_gas: MIN_GAS_AMOUNT,
	};
}

function createWithdrawMemo({
	receiverAddress,
	xrpMemo,
}: {
	receiverAddress: string;
	xrpMemo: string | undefined;
}) {
	// Strip "bitcoincash:" prefix from BCH CashAddr addresses
	const normalizedAddress = receiverAddress
		.toLowerCase()
		.startsWith("bitcoincash:")
		? receiverAddress.slice("bitcoincash:".length)
		: receiverAddress;

	const memo = ["WITHDRAW_TO", normalizedAddress];

	if (xrpMemo != null && xrpMemo !== "") {
		memo.push(xrpMemo);
	}

	return memo.join(":");
}

const caip2Mapping = {
	[Chains.Ethereum]: "eth:1",
	[Chains.Base]: "eth:8453",
	[Chains.Arbitrum]: "eth:42161",
	[Chains.Bitcoin]: "btc:mainnet",
	[Chains.BitcoinCash]: "bch:mainnet",
	[Chains.Solana]: "sol:mainnet",
	[Chains.Dogecoin]: "doge:mainnet",
	[Chains.XRPL]: "xrp:mainnet",
	[Chains.Zcash]: "zec:mainnet",
	[Chains.Gnosis]: "eth:100",
	[Chains.Berachain]: "eth:80094",
	[Chains.Tron]: "tron:mainnet",
	[Chains.Sui]: "sui:mainnet",
	[Chains.Aptos]: "aptos:mainnet",
	[Chains.Cardano]: "cardano:mainnet",
	[Chains.Litecoin]: "ltc:mainnet",
	[Chains.Starknet]: "starknet:mainnet",
} satisfies Record<
	string,
	(typeof poaBridge.PoaBridgeNetworkReference)[Exclude<
		keyof typeof poaBridge.PoaBridgeNetworkReference,
		"NEAR" | "POLYGON" | "BSC" | "MONAD"
	>]
>;

export function toPoaNetwork(caip2: string) {
	if ((caip2Mapping as Record<string, string>)[caip2] == null) {
		throw new Error(`Unsupported POA Bridge chain = ${caip2}`);
	}
	return caip2Mapping[caip2 as keyof typeof caip2Mapping];
}

const tokenPrefixMapping = {
	eth: Chains.Ethereum,
	base: Chains.Base,
	arb: Chains.Arbitrum,
	btc: Chains.Bitcoin,
	bch: Chains.BitcoinCash,
	sol: Chains.Solana,
	doge: Chains.Dogecoin,
	xrp: Chains.XRPL,
	zec: Chains.Zcash,
	gnosis: Chains.Gnosis,
	bera: Chains.Berachain,
	tron: Chains.Tron,
	sui: Chains.Sui,
	aptos: Chains.Aptos,
	cardano: Chains.Cardano,
	ltc: Chains.Litecoin,
	starknet: Chains.Starknet,
	aleo: Chains.Aleo
};

export function contractIdToCaip2(contractId: string): Chain {
	for (const [prefix, caip2] of Object.entries(tokenPrefixMapping)) {
		if (
			contractId.startsWith(`${prefix}.`) ||
			contractId.startsWith(`${prefix}-`)
		) {
			return caip2;
		}
	}

	throw new Error(`Unsupported POA Bridge contractId = ${contractId}`);
}
