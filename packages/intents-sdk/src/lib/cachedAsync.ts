export default function cachedAsync<T, Args extends unknown[]>({
	func,
	ttl,
	conditionalCaching,
}: {
	func: (...args: Args) => Promise<T>;
	ttl: number;
	conditionalCaching?: (result: T) => boolean;
}): (...args: Args) => Promise<T> {
	let lastRequest = 0;
	let value: T;
	let pending: Promise<T> | null = null;

	return async (...args: Args): Promise<T> => {
		const now = Date.now();

		if (lastRequest >= now - ttl) {
			return value;
		}

		if (pending !== null) {
			return pending;
		}

		pending = func(...args);
		try {
			const result = await pending;
			pending = null;
			// cache value in case no conditionalCaching function passed or if it returns true
			if (conditionalCaching === undefined || conditionalCaching(result)) {
				lastRequest = now;
				value = result;
			}
			return result;
		} catch (error) {
			pending = null;
			throw error;
		}
	};
}
