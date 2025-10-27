import {
	configsByEnvironment,
	type NearIntentsEnv,
} from "@defuse-protocol/internal-utils";
import type { ISaltManager } from "./interfaces/salt-manager";
import type { providers } from "near-api-js";
import type { Salt } from "./expirable-nonce";
import * as v from "valibot";

import { utils } from "@defuse-protocol/internal-utils";

const SALT_TTL_SEC = 30 * 1000; // 30 seconds

export class SaltManager implements ISaltManager {
	protected intentsContract: string;
	protected nearProvider: providers.Provider;
	protected currentSalt: Salt | null = null;
	private fetchPromise: Promise<Salt> | null = null;
	private lastFetchTime = 0;

	constructor({
		env,
		nearProvider,
	}: {
		env: NearIntentsEnv;
		nearProvider: providers.Provider;
	}) {
		this.intentsContract = configsByEnvironment[env].contractID;
		this.nearProvider = nearProvider;
	}

	async getCachedSalt(): Promise<Salt> {
		if (this.isCacheValid()) {
			return this.currentSalt!;
		}

		if (this.fetchPromise) {
			return this.fetchPromise;
		}

		this.fetchPromise = this.fetchAndCache();

		try {
			return await this.fetchPromise;
		} finally {
			this.fetchPromise = null;
		}
	}

	async fetchAndCache(): Promise<Salt> {
		const salt = await fetchSalt(this.nearProvider, this.intentsContract);

		this.currentSalt = salt;
		this.lastFetchTime = Date.now();

		return this.currentSalt;
	}

	isCacheValid(): boolean {
		return (
			this.currentSalt !== null &&
			Date.now() - this.lastFetchTime < SALT_TTL_SEC
		);
	}

	async refresh(): Promise<Salt> {
		this.invalidateCache();
		return this.getCachedSalt();
	}

	private invalidateCache(): void {
		this.currentSalt = null;
		this.lastFetchTime = 0;
	}
}

/**
 * Fetches the current salt from the NEAR contract
 * @param nearProvider Near provider used for querying the contract
 * @param contractId The NEAR contract ID to query
 * @returns Promise resolving to the salt
 */
export async function fetchSalt(
	nearProvider: providers.Provider,
	contractId: string,
): Promise<Salt> {
	return utils.queryContract({
		contractId,
		methodName: "current_salt",
		args: {},
		finality: "optimistic",
		nearClient: nearProvider,
		schema: v.number(),
	});
}
