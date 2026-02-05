import type { EnvConfig } from "@defuse-protocol/internal-utils";
import type { ISaltManager } from "./interfaces/salt-manager";
import type { providers } from "near-api-js";
import type { Salt } from "./expirable-nonce";
import * as v from "valibot";
import { utils } from "@defuse-protocol/internal-utils";
import { hex } from "@scure/base";

export const SALT_TTL_MS = 5 * 60 * 1000; // 5 mins

/**
 * Salt manager that returns a static, pre-configured salt.
 * Use when salt is known ahead of time (e.g., private blockchain with fixed salt).
 */
export class StaticSaltManager implements ISaltManager {
	private salt: Salt;

	/**
	 * @param saltHex Salt as hex string (e.g., "01020304")
	 */
	constructor(saltHex: string) {
		this.salt = hex.decode(saltHex);
		if (this.salt.length !== 4) {
			throw new Error(`Invalid salt length: ${this.salt.length}, expected 4`);
		}
	}

	async getCachedSalt(): Promise<Salt> {
		return this.salt;
	}

	async refresh(): Promise<Salt> {
		return this.salt;
	}
}

export class SaltManager implements ISaltManager {
	protected intentsContract: string;
	protected nearProvider: providers.Provider;
	protected currentSalt: Salt | null = null;
	private fetchPromise: Promise<Salt> | null = null;
	private lastFetchTime = 0;

	constructor({
		envConfig,
		nearProvider,
	}: {
		envConfig: EnvConfig;
		nearProvider: providers.Provider;
	}) {
		this.intentsContract = envConfig.contractID;
		this.nearProvider = nearProvider;
	}

	/**
	 * Returns the cached salt if it's valid, otherwise fetches a new one
	 * Deduplicates concurrent requests so only one fetch runs at a time
	 */
	async getCachedSalt(): Promise<Salt> {
		if (this.isCacheValid()) {
			// biome-ignore lint/style/noNonNullAssertion: isCacheValid ensures currentSalt is set
			return this.currentSalt!;
		}

		if (this.fetchPromise) {
			return this.fetchPromise;
		}

		this.fetchPromise = this.fetchAndCache().finally(() => {
			this.fetchPromise = null;
		});

		return this.fetchPromise;
	}

	/**
	 * Fetches a new salt from the contract and updates the cache
	 */
	async refresh(): Promise<Salt> {
		this.invalidateCache();

		return this.getCachedSalt();
	}

	async fetchAndCache(): Promise<Salt> {
		try {
			const salt = await fetchSalt(this.nearProvider, this.intentsContract);

			this.currentSalt = salt;
			this.lastFetchTime = Date.now();

			return this.currentSalt;
		} catch (err) {
			this.fetchPromise = null;

			throw new Error(`Failed to fetch salt`, { cause: err });
		}
	}

	private isCacheValid(): boolean {
		return (
			this.currentSalt != null && Date.now() - this.lastFetchTime < SALT_TTL_MS
		);
	}

	private invalidateCache(): void {
		this.currentSalt = null;
		this.lastFetchTime = 0;
	}
}

/**
 * Fetches the current salt from the NEAR contract
 *
 * @param nearProvider Near provider used for querying the contract
 * @param contractId The NEAR contract ID to query
 * @returns Promise resolving to the salt
 */
export async function fetchSalt(
	nearProvider: providers.Provider,
	contractId: string,
): Promise<Salt> {
	const value = await utils.queryContract({
		contractId,
		methodName: "current_salt",
		args: {},
		finality: "optimistic",
		nearClient: nearProvider,
		schema: v.string(),
	});

	return hex.decode(value);
}
