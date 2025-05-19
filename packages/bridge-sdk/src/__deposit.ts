import type { IntentsUserId } from "@defuse-protocol/defuse-sdk";
import * as poaBridgeAPI from "@defuse-protocol/defuse-sdk/dist/sdk/poaBridge/poaBridgeHttpClient/apis";
import { getDepositedBalances } from "@defuse-protocol/defuse-sdk/dist/services/defuseBalanceService";
import { authHandleToIntentsUserId } from "@defuse-protocol/defuse-sdk/dist/utils/authIdentity";
import { providers } from "near-api-js";
import {
	http,
	type Account,
	type Chain,
	type Transport,
	createWalletClient,
	getAddress,
	publicActions,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import { env } from "./env";

void main();

async function main() {
	await deposit({
		intentsUserId: authHandleToIntentsUserId({
			identifier: env.SECRET_EVM_ADDRESS,
			method: "evm",
		}),
		wallet: createWalletClient({
			account: privateKeyToAccount(env.SECRET_EVM_PRIVATE_KEY),
			transport: http(),
			chain: polygon,
		}),
	});
}

export async function deposit({
	intentsUserId,
	wallet,
}: {
	intentsUserId: IntentsUserId;
	wallet: import("viem").WalletClient<Transport, Chain, Account>;
}) {
	// biome-ignore lint/suspicious/noConsole: <explanation>
	console.log(
		"Balance:",
		await getDepositedBalances(
			intentsUserId,
			["nep245:v2_1.omni.hot.tg:137_11111111111111111111"],
			new providers.JsonRpcProvider({
				url: "https://rpc.mainnet.near.org",
			}),
		),
	);

	const depositAddressResult = await poaBridgeAPI.getDepositAddress({
		account_id: intentsUserId,
		chain: "eth:137",
		// we can specify bridge: either bridge name or token?
	});

	// biome-ignore lint/suspicious/noConsole: <explanation>
	console.log("Deposit address:", depositAddressResult.address);

	const txHash = await wallet.sendTransaction({
		to: getAddress(depositAddressResult.address),
		value: 1000000000000000000n,
	});

	// biome-ignore lint/suspicious/noConsole: <explanation>
	console.log("Deposit tx hash:", txHash);

	const receipt = await wallet
		.extend(publicActions)
		.waitForTransactionReceipt({ hash: txHash });

	if (receipt.status !== "success") {
		throw new Error("Transaction failed");
	}

	// biome-ignore lint/suspicious/noConsole: <explanation>
	console.log("Deposit tx mined");

	while (true) {
		const { deposits } = await poaBridgeAPI.getDepositStatus({
			account_id: intentsUserId,
			chain: "eth:137",
		});

		const deposit = deposits.find((deposit) => deposit.tx_hash === txHash);

		if (deposit?.status === "COMPLETED") {
			// biome-ignore lint/suspicious/noConsole: <explanation>
			console.log("Deposit completed");

			// biome-ignore lint/suspicious/noConsole: <explanation>
			console.log(
				"Balance:",
				await getDepositedBalances(
					intentsUserId,
					["nep245:v2_1.omni.hot.tg:137_11111111111111111111"],
					new providers.JsonRpcProvider({
						url: "https://rpc.mainnet.near.org",
					}),
				),
			);
			break;
		}

		await new Promise((resolve) => setTimeout(resolve, 2000));
	}
}
