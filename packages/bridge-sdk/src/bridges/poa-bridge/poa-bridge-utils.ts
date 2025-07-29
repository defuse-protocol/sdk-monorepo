import { type poaBridge, utils } from "@defuse-protocol/internal-utils";
import type { IntentPrimitive } from "../../intents/shared-types";
import { type Chain, Chains } from "../../lib/caip2";

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
	};
}

function createWithdrawMemo({
	receiverAddress,
	xrpMemo,
}: {
	receiverAddress: string;
	xrpMemo: string | undefined;
}) {
	const memo = ["WITHDRAW_TO", receiverAddress];

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
	[Chains.Solana]: "sol:mainnet",
	[Chains.Dogecoin]: "doge:mainnet",
	[Chains.XRPL]: "xrp:mainnet",
	[Chains.Zcash]: "zec:mainnet",
	[Chains.Gnosis]: "eth:100",
	[Chains.Berachain]: "eth:80094",
	[Chains.Tron]: "tron:mainnet",
	[Chains.Sui]: "sui:mainnet",
	[Chains.Aptos]: "aptos:mainnet",
} satisfies Record<
	string,
	(typeof poaBridge.PoaBridgeNetworkReference)[Exclude<
		keyof typeof poaBridge.PoaBridgeNetworkReference,
		"NEAR" | "POLYGON" | "BSC"
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
	sol: Chains.Solana,
	doge: Chains.Dogecoin,
	xrp: Chains.XRPL,
	zec: Chains.Zcash,
	gnosis: Chains.Gnosis,
	bera: Chains.Berachain,
	tron: Chains.Tron,
	sui: Chains.Sui,
	aptos: Chains.Aptos,
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
