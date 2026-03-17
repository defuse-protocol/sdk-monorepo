import {
	QuoteOutputFactory,
	RequestTimeoutError,
	SolverRelayClient,
} from "./index";
import { createLogger } from "./example-logger";
import {
	createIntentSignerViem,
	IntentsSDK,
} from "@defuse-protocol/intents-sdk";
import { privateKeyToAccount } from "viem/accounts";

const log = createLogger("debug");
const privateSDK = new IntentsSDK({
	env: {
		contractID: "privintents.test.near",
		poaTokenFactoryContractID: "",
		poaBridgeBaseURL: "",
		solverRelayBaseURL: "",
		managerConsoleBaseURL: "",
		nearIntentsBaseURL: "",
		bridgeIndexerURL: "",
	},
	referral: `test`,
});

const publicSDK = new IntentsSDK({ referral: "test", env: "stage" });
const client = new SolverRelayClient({
	wsUrl: "wss://solver-relay-stage.intents-near.org/ws",
});

await client.connect();

await client.subscribeQuotes();
await client.subscribeQuoteStatus();

log.info("connected");

const supportedTokens = [
	"nep141:usdt.tether-token.near",
	"nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
];

client.on("quote", async (quoteReq, _metadata) => {
	const { exact_amount_in, exact_amount_out } = quoteReq;
	const swapType = exact_amount_in ? "EXACT_INPUT" : "EXACT_OUTPUT";
	const amount = exact_amount_in ? exact_amount_in : exact_amount_out;
	if (!amount) {
		return;
	}
	if (
		!supportedTokens.includes(quoteReq.defuse_asset_identifier_in) ||
		!supportedTokens.includes(quoteReq.defuse_asset_identifier_out)
	) {
		return;
	}
	const amountIn = amount;
	const amountOut = amount;
	log.info("quote received", {
		quoteId: quoteReq.quote_id,
		tokenIn: quoteReq.defuse_asset_identifier_in,
		tokenOut: quoteReq.defuse_asset_identifier_out,
		amount: amount,
		swapType,
	});
	const signer = createIntentSignerViem({
		// @ts-expect-error
		signer: privateKeyToAccount(import.meta.env.SECRET_EVM_PRIVATE_KEY),
	});
	const { signed: swap } = await privateSDK
		.intentBuilder()
		.addIntent({
			intent: "token_diff",
			diff: {
				[quoteReq.defuse_asset_identifier_in]: amountIn,
				[quoteReq.defuse_asset_identifier_out]: `-${amountOut}`,
			},
		})
		.buildAndSign(signer);
	const { signed: shield } = await publicSDK
		.intentBuilder()
		.buildAndSign(signer);
	const { signed: recover } = await privateSDK
		.intentBuilder()
		.buildAndSign(signer);
	log.debug("sending quote response", {
		quoteId: quoteReq.quote_id,
		amountOut,
	});
	const result = await client.sendQuoteResponse({
		quote_id: quoteReq.quote_id,
		quote_output: QuoteOutputFactory.success({
			amount_in: amountIn,
			amount_out: amountOut,
		}),
		signed_data: swap,
		private_signed_data: { shield, swap, recover },
	});

	result.match(
		(res) => {
			if (!res.accepted) {
				log.error("not accepted", {
					quoteId: quoteReq.quote_id,
					message: JSON.stringify(res.error?.message),
				});
			} else {
				log.info("accepted", {
					quoteId: quoteReq.quote_id,
				});
			}
		},
		(error) => {
			if (error instanceof RequestTimeoutError) {
				log.warn(`timeout after ${error.timeoutMs}ms`, {
					quoteId: quoteReq.quote_id,
				});
			} else {
				log.error("failed", {
					quoteId: quoteReq.quote_id,
					message: error.message,
				});
			}
		},
	);
});

client.on("quoteStatus", (event) => {
	log.info("quote status", {
		eventType: event.event_type,
		quoteHash: event.quote_hash,
		intentHash: event.intent_hash,
		txHash: event.tx_hash,
	});
});
