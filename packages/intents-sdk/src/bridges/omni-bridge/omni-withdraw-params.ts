import { assert, utils } from "@defuse-protocol/internal-utils";
import { ChainKind, omniAddress, type OmniAddress } from "@omni-bridge/core";
import { calculateStorageAccountId } from "@omni-bridge/near";
import type { Chain } from "../../lib/caip2";
import { RouteEnum } from "../../constants/route-enum";
import { getUnderlyingFee } from "../../lib/estimate-fee";
import type { FeeEstimation } from "../../shared-types";
import { CHAIN_MAPPINGS } from "./omni-bridge-utils";

/**
 * The values an Omni withdrawal computes before it builds the intents.
 *
 * `storageDepositAccountId` is derived from `externalId`, and letter case takes part in that
 * derivation, so recomputing any of these sends the native fee to a different account.
 */
export type OmniWithdrawIntentParams = {
	/** The NEP-141 account of the asset. */
	tokenAccountId: string;
	recipient: OmniAddress;
	/** Empty, except for a UTXO chain. Then it contains `MaxGasFee`. */
	msg: string;
	/**
	 * This value makes the storage account unique. The hash covers the rest of the transfer,
	 * so two withdrawals that match on every field would otherwise land on one account.
	 * `calculateStorageAccountId` throws above 64 UTF-8 bytes.
	 */
	externalId: string;
	/** The account that gets the native fee. Null if there is no native fee. */
	storageDepositAccountId: string | null;
	/**
	 * The amount the `ft_withdraw` carries. A UTXO chain adds its own fees to the amount the
	 * caller asked for, because they are paid from the asset and not from wrap.near.
	 */
	amount: bigint;
	/** The relayer fee. It goes in `native_token_fee`, and the storage deposit transfers it. */
	nativeFee: bigint;
	/** The `storage_deposit` of the `ft_withdraw`. Zero leaves the field out. */
	storageDepositAmount: bigint;
};

/**
 * Computes the values of an Omni withdrawal without building the intents. `OmniBridge` calls
 * it too, so a caller that signs the payload elsewhere gets the same numbers.
 * @param params.actualAmount Net of `feeEstimation.amount`. `IntentsSDK` subtracts it for a
 * fee-inclusive withdrawal, so a caller that builds the payload itself has to do the same
 * @param params.feeEstimation Read for every fee of the route, one of which raises the amount
 * @param params.externalId Supply one to repeat an earlier call.
 * `calculateStorageAccountId` throws above 64 UTF-8 bytes. Omit it and the function draws a
 * random one
 * @returns The values the `ft_withdraw` carries
 */
export function deriveOmniWithdrawIntentParams(params: {
	assetId: string;
	destinationAddress: string;
	actualAmount: bigint;
	omniChainKind: ChainKind;
	intentsContract: string;
	feeEstimation: FeeEstimation;
	externalId?: string;
}): OmniWithdrawIntentParams {
	const { contractId: tokenAccountId, standard } = utils.parseDefuseAssetId(
		params.assetId,
	);
	assert(standard === "nep141", "Only NEP-141 is supported");

	const nativeFee = getUnderlyingFee(
		params.feeEstimation,
		RouteEnum.OmniBridge,
		"relayerFee",
	);
	assert(
		nativeFee >= 0n,
		`Invalid Omni bridge relayer fee: expected >= 0, got ${nativeFee}`,
	);
	const storageDepositAmount = getUnderlyingFee(
		params.feeEstimation,
		RouteEnum.OmniBridge,
		"storageDepositFee",
	);

	let amount = params.actualAmount;
	let msg = "";
	// For withdrawals to Bitcoin and other UTXO chains we need to specify maxGasFee to the relayer
	// that is picking up our TX and sends it to a connector (btc connector for example).
	// Technically we can avoid specifying it in the message and relayer just takes the same value
	// however this introduces a risk that a malicious actor can pick up this tx and submit it to the connector
	// with a higher max gas fee value that can result in recipient getting less BTC.
	// Example with nep141:nbtc.bridge.near (made-up values):
	// utxoFees = 50 + 50 = 100, relayerFee = 2 (excluded; paid in wrap.near)
	//   feeInclusive=false: amount = 4000 -> intent = 4100 -> user receives 4000
	//   feeInclusive=true:  amount = 3898 -> intent = 3998 -> user receives 3898
	if (isUtxoChain(params.omniChainKind)) {
		const utxoMaxGasFee = getUnderlyingFee(
			params.feeEstimation,
			RouteEnum.OmniBridge,
			"utxoMaxGasFee",
		);
		const utxoProtocolFee = getUnderlyingFee(
			params.feeEstimation,
			RouteEnum.OmniBridge,
			"utxoProtocolFee",
		);
		assert(
			utxoMaxGasFee !== undefined && utxoMaxGasFee > 0n,
			`Invalid Omni Bridge utxo max gas fee: expected > 0, got ${utxoMaxGasFee}`,
		);
		assert(
			utxoProtocolFee !== undefined && utxoProtocolFee > 0n,
			`Invalid Omni Bridge utxo protocol fee: expected > 0, got ${utxoProtocolFee}`,
		);

		// UTXO withdrawals add protocol + max gas fees to the intent amount since they're paid
		// from the withdrawn asset, not wrap.near.
		amount += utxoMaxGasFee + utxoProtocolFee;
		msg = JSON.stringify({ MaxGasFee: utxoMaxGasFee.toString() });
	}

	// Omni contract only accepts lowercase bech32 addresses; uppercase/mixed-case
	// bech32 is spec-valid but rejected on-chain. Base58 (legacy/P2SH) is left as-is.
	const destinationAddress =
		params.omniChainKind === ChainKind.Btc &&
		/^bc1/i.test(params.destinationAddress)
			? params.destinationAddress.toLowerCase()
			: params.destinationAddress;

	const recipient = omniAddress(params.omniChainKind, destinationAddress);
	const externalId = params.externalId ?? crypto.randomUUID();

	return {
		tokenAccountId,
		recipient,
		msg,
		externalId,
		amount,
		nativeFee,
		storageDepositAmount,
		storageDepositAccountId:
			nativeFee > 0n
				? calculateStorageAccountId(
						{
							token: `near:${tokenAccountId}`,
							amount,
							recipient,
							fee: {
								fee: 0n,
								native_fee: nativeFee,
							},
							sender: `near:${params.intentsContract}`,
							msg,
						},
						externalId,
					)
				: null,
	};
}

export function caip2ToChainKind(network: Chain): ChainKind | null {
	return CHAIN_MAPPINGS.find(([chain]) => chain === network)?.[1] ?? null;
}

const UTXO_CHAINS: ChainKind[] = [ChainKind.Btc, ChainKind.Zcash];

export function isUtxoChain(network: ChainKind): boolean {
	return UTXO_CHAINS.includes(network);
}
