// It is AbortSignal.any
export function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
	if (signals.length === 1) {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		return signals[0]!;
	}

	const controller = new AbortController();

	for (const signal of signals) {
		if (signal.aborted) {
			controller.abort(signal.reason);
			break;
		}
	}

	const abortHandler = (event: Event) => {
		const signal = event.target as AbortSignal;
		controller.abort(signal.reason);
	};

	for (const signal of signals) {
		signal.addEventListener("abort", abortHandler, { once: true });
	}

	return controller.signal;
}
