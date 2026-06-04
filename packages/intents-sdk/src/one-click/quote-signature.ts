import { sha256 } from "@noble/hashes/sha2";
import { base58 } from "@scure/base";
import stringify from "json-stable-stringify";
import nacl from "tweetnacl";

const ED25519_PREFIX = "ed25519:";
const ONE_CLICK_MANAGER_PUB_KEY =
	"ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc";

export type OneClickQuoteRequest = {
	dry: boolean;
	depositMode?: string;
	swapType: string;
	slippageTolerance: number;
	originAsset: string;
	depositType: string;
	destinationAsset: string;
	amount: string;
	refundTo: string;
	refundType: string;
	recipient: string;
	recipientType: string;
	connectedWallets?: string[];
	sessionId?: string;
	virtualChainRecipient?: string;
	virtualChainRefundRecipient?: string;
	customRecipientMsg?: string;
	deadline: string;
	referral?: string;
	quoteWaitingTimeMs?: number;
	appFees?: {
		recipient: string;
		fee: number;
	}[];
	correlationId?: string;
	partnerId?: string;
	userAccountId?: string;
	clientIp?: string;
	clientHeaders?: Record<string, string>;
	confidentiality?: string;
};

export type OneClickQuote = {
	depositAddress?: string;
	depositMemo?: string;
	amountIn: string;
	amountInFormatted: string;
	amountInUsd: string;
	minAmountIn: string;
	amountOut: string;
	amountOutFormatted: string;
	amountOutUsd: string;
	minAmountOut: string;
	deadline?: string;
	timeWhenInactive?: string;
	timeEstimate?: number;
	refundFee?: string;
	withdrawFee?: string;
};

export type OneClickQuoteResponse = {
	timestamp: string;
	signature: string;
	quoteRequest: OneClickQuoteRequest;
	quote: OneClickQuote;
	correlationId?: string;
};

export type OneClickSignedQuoteRequest = {
	dry: boolean;
	swapType: string;
	slippageTolerance: number;
	originAsset: string;
	depositType: string;
	destinationAsset: string;
	amount: string;
	refundTo: string;
	refundType: string;
	recipient: string;
	recipientType: string;
	deadline: string;
	quoteWaitingTimeMs?: number;
	referral?: string;
	virtualChainRecipient?: string;
	virtualChainRefundRecipient?: string;
	customRecipientMsg?: string;
	sessionId?: undefined;
	connectedWallets?: undefined;
	correlationId?: undefined;
	appFees?: undefined;
	partnerId?: undefined;
	userAccountId?: undefined;
	depositMode?: undefined;
};

export type OneClickSignedQuote = {
	amountIn: string;
	amountInFormatted: string;
	amountInUsd: string;
	minAmountIn: string;
	amountOut: string;
	amountOutFormatted: string;
	amountOutUsd: string;
	minAmountOut: string;
};

export function buildSignedQuoteRequest(
	response: OneClickQuoteResponse,
): OneClickSignedQuoteRequest {
	const { quoteRequest } = response;

	return {
		dry: quoteRequest.dry,
		swapType: quoteRequest.swapType,
		slippageTolerance: quoteRequest.slippageTolerance,
		originAsset: quoteRequest.originAsset,
		depositType: quoteRequest.depositType,
		destinationAsset: quoteRequest.destinationAsset,
		amount: quoteRequest.amount,
		refundTo: quoteRequest.refundTo,
		refundType: quoteRequest.refundType,
		recipient: quoteRequest.recipient,
		recipientType: quoteRequest.recipientType,
		deadline: quoteRequest.deadline,
		quoteWaitingTimeMs: quoteRequest.quoteWaitingTimeMs
			? quoteRequest.quoteWaitingTimeMs
			: undefined,
		referral: quoteRequest.referral ? quoteRequest.referral : undefined,
		virtualChainRecipient: quoteRequest.virtualChainRecipient
			? quoteRequest.virtualChainRecipient
			: undefined,
		virtualChainRefundRecipient: quoteRequest.virtualChainRefundRecipient
			? quoteRequest.virtualChainRefundRecipient
			: undefined,
		customRecipientMsg: quoteRequest.customRecipientMsg
			? quoteRequest.customRecipientMsg
			: undefined,
		sessionId: undefined,
		connectedWallets: undefined,
		correlationId: undefined,
		appFees: undefined,
		partnerId: undefined,
		userAccountId: undefined,
		depositMode: undefined,
	};
}

export function buildSignedQuote(
	response: OneClickQuoteResponse,
): OneClickSignedQuote {
	const { quote } = response;

	return {
		amountIn: quote.amountIn,
		amountInFormatted: quote.amountInFormatted,
		amountInUsd: quote.amountInUsd,
		minAmountIn: quote.minAmountIn,
		amountOut: quote.amountOut,
		amountOutFormatted: quote.amountOutFormatted,
		amountOutUsd: quote.amountOutUsd,
		minAmountOut: quote.minAmountOut,
	};
}

export function hashQuote(
	request: OneClickSignedQuoteRequest,
	quote: OneClickSignedQuote,
	timestamp: string,
): string {
	const dataString = stringify({
		...request,
		...quote,
		timestamp,
	});
	return base58.encode(sha256(new TextEncoder().encode(dataString)));
}

export function quoteHash(response: OneClickQuoteResponse): string {
	return hashQuote(
		buildSignedQuoteRequest(response),
		buildSignedQuote(response),
		response.timestamp,
	);
}

export function verifyQuoteSignature(
	response: OneClickQuoteResponse,
	managerPublicKey = ONE_CLICK_MANAGER_PUB_KEY,
): boolean {
	try {
		const signatureBytes = decodeEd25519Base58(response.signature);
		const publicKeyBytes = decodeEd25519Base58(managerPublicKey);
		const message = new TextEncoder().encode(quoteHash(response));

		return nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes);
	} catch {
		return false;
	}
}

function decodeEd25519Base58(value: string): Uint8Array {
	const encoded = value.startsWith(ED25519_PREFIX)
		? value.slice(ED25519_PREFIX.length)
		: value;
	return base58.decode(encoded);
}
