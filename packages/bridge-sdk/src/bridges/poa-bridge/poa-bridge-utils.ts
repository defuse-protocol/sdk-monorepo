import { type poaBridge, utils } from "@defuse-protocol/internal-utils";
import type { IntentPrimitive } from "../../intents/shared-types";
import { CAIP2_NETWORK } from "../../lib/caip2";

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
	[CAIP2_NETWORK.Ethereum]: "eth:1",
	[CAIP2_NETWORK.Base]: "eth:8453",
	[CAIP2_NETWORK.Arbitrum]: "eth:42161",
	[CAIP2_NETWORK.Bitcoin]: "btc:mainnet",
	[CAIP2_NETWORK.Solana]: "sol:mainnet",
	[CAIP2_NETWORK.Dogecoin]: "doge:mainnet",
	[CAIP2_NETWORK.XRPL]: "xrp:mainnet",
	[CAIP2_NETWORK.Zcash]: "zec:mainnet",
	[CAIP2_NETWORK.Gnosis]: "eth:100",
	[CAIP2_NETWORK.Berachain]: "eth:80094",
	[CAIP2_NETWORK.Tron]: "tron:mainnet",
	[CAIP2_NETWORK.Sui]: "sui:mainnet",
	[CAIP2_NETWORK.Aptos]: "aptos:mainnet",
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
	eth: CAIP2_NETWORK.Ethereum,
	base: CAIP2_NETWORK.Base,
	arb: CAIP2_NETWORK.Arbitrum,
	btc: CAIP2_NETWORK.Bitcoin,
	sol: CAIP2_NETWORK.Solana,
	doge: CAIP2_NETWORK.Dogecoin,
	xrp: CAIP2_NETWORK.XRPL,
	zec: CAIP2_NETWORK.Zcash,
	gnosis: CAIP2_NETWORK.Gnosis,
	bera: CAIP2_NETWORK.Berachain,
	tron: CAIP2_NETWORK.Tron,
	sui: CAIP2_NETWORK.Sui,
	aptos: CAIP2_NETWORK.Aptos,
};

export function contractIdToCaip2(contractId: string): CAIP2_NETWORK {
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
