import { BaseError } from "../../errors/base";

export function withTimeout<data>(
	fn: ({
		signal,
	}: {
		signal: AbortController["signal"] | null;
	}) => Promise<data>,
	{
		errorInstance = new Error("timed out"),
		timeout,
		signal,
	}: {
		// The error instance to throw when the timeout is reached.
		errorInstance?: Error | undefined;
		// The timeout (in ms).
		timeout: number;
		// Whether or not the timeout should use an abort signal.
		signal?: boolean | undefined;
	},
): Promise<data> {
	return new Promise((resolve, reject) => {
		(async () => {
			let timeoutId!: NodeJS.Timeout;
			try {
				const controller = new AbortController();
				if (timeout > 0) {
					timeoutId = setTimeout(() => {
						if (signal) {
							controller.abort(new SpecialInternalTimeoutError());
						} else {
							reject(errorInstance);
						}
					}, timeout);
				}
				resolve(await fn({ signal: signal ? controller.signal : null }));
			} catch (err) {
				if (err instanceof SpecialInternalTimeoutError) reject(errorInstance);
				reject(err);
			} finally {
				clearTimeout(timeoutId);
			}
		})();
	});
}

class SpecialInternalTimeoutError extends BaseError {
	constructor() {
		super("Special internal timeout error.", {
			name: "SpecialInternalTimeoutError",
			details:
				"This error should be never be caught since another error instance is rethrown.",
		});
	}
}
