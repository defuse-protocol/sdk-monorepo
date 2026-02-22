import { LRUCache } from "lru-cache";

type Options<K extends {}, V extends {}> = LRUCache.Options<K, V, unknown> & {
	shouldCache?: (value: V) => boolean;
};

export class ConditionalLRUCache<K extends {}, V extends {}> extends LRUCache<
	K,
	V
> {
	private shouldCache?: (value: V) => boolean;

	constructor(options: Options<K, V>) {
		const { shouldCache, ...lruOptions } = options;
		super(lruOptions);
		this.shouldCache = shouldCache;
	}

	override async fetch(
		key: K,
		fetchOptions?: LRUCache.FetchOptions<K, V, unknown>,
	): Promise<V | undefined> {
		const value = await super.fetch(key, fetchOptions);

		if (value !== undefined && this.shouldCache && !this.shouldCache(value)) {
			this.delete(key);
		}

		return value;
	}

	override async forceFetch(
		key: K,
		fetchOptions?: LRUCache.FetchOptions<K, V, unknown>,
	): Promise<V> {
		const value = await super.forceFetch(key, fetchOptions);

		if (this.shouldCache && !this.shouldCache(value)) {
			this.delete(key);
		}

		return value;
	}
}
