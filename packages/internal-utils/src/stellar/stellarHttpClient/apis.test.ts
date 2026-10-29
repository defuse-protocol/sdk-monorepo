import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../test/setup";
import { getAccount } from "./apis";
import { StellarAccountNotFoundError } from "./errors";

const HORIZON_URL = "https://horizon.example.com";
const ACCOUNT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("getAccount()", () => {
	it("returns account balances including trustlines", async () => {
		server.use(
			http.get(`${HORIZON_URL}/accounts/${ACCOUNT}`, () =>
				HttpResponse.json({
					id: ACCOUNT,
					account_id: ACCOUNT,
					sequence: "1",
					balances: [
						{
							balance: "1.0000000",
							limit: "922337203685.4775807",
							asset_type: "credit_alphanum4",
							asset_code: "USDC",
							asset_issuer: USDC_ISSUER,
						},
						{ balance: "99.4338384", asset_type: "native" },
					],
				}),
			),
		);

		const account = await getAccount(ACCOUNT, { baseURL: HORIZON_URL });

		expect(account.balances).toEqual([
			{
				balance: "1.0000000",
				asset_type: "credit_alphanum4",
				asset_code: "USDC",
				asset_issuer: USDC_ISSUER,
			},
			{ balance: "99.4338384", asset_type: "native" },
		]);
	});

	it("throws StellarAccountNotFoundError when Horizon responds with 404", async () => {
		server.use(
			http.get(`${HORIZON_URL}/accounts/${ACCOUNT}`, () =>
				HttpResponse.json(
					{
						type: "https://stellar.org/horizon-errors/not_found",
						title: "Resource Missing",
						status: 404,
					},
					{ status: 404 },
				),
			),
		);

		await expect(
			getAccount(ACCOUNT, { baseURL: HORIZON_URL }),
		).rejects.toBeInstanceOf(StellarAccountNotFoundError);
	});
});
