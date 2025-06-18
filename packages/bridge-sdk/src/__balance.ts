import { getDepositedBalances } from "@defuse-protocol/defuse-sdk/dist/services/defuseBalanceService";
import { utils } from "@defuse-protocol/internal-utils";
import { HotBridge } from "@hot-labs/omni-sdk";
import { providers } from "near-api-js";
import { env } from "./env";

const hot = new HotBridge({
	async executeNearTransaction() {
		throw new Error("not implemented");
	},
});

const intentsUserId = utils.authHandleToIntentsUserId({
	identifier: env.SECRET_EVM_ADDRESS,
	method: "evm",
});

const balance = await hot.getAllIntentBalances(intentsUserId);

// biome-ignore lint/suspicious/noConsole: <explanation>
console.log(
	Object.fromEntries(
		Object.entries(balance).filter(([, balance]) => balance > 0n),
	),
);

// biome-ignore lint/suspicious/noConsole: <explanation>
console.log(
	await getDepositedBalances(
		intentsUserId,
		["nep245:v2_1.omni.hot.tg:137_11111111111111111111"],
		new providers.JsonRpcProvider({
			url: "https://rpc.mainnet.near.org",
		}),
	),
);
