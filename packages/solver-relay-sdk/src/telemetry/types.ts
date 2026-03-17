/**
 * Generic span-like interface to avoid direct OpenTelemetry dependency.
 * Implementations should map to their actual span type.
 */
export interface SpanLike {
	setAttribute(key: string, value: string | number | boolean): void;
	recordException(error: Error): void;
}

/**
 * Trace context extracted from traceparent header.
 * Implementations should return their specific context type.
 */
export type TraceContext = unknown;

/**
 * Telemetry hooks for trace context propagation.
 *
 * SDK does not depend on OpenTelemetry directly. Instead, solvers provide
 * these hooks to enable trace propagation.
 *
 * @example
 * ```typescript
 * import { context, propagation, trace } from '@opentelemetry/api';
 *
 * const telemetryHooks: TelemetryHooks = {
 *   extractTraceContext: (traceparent) =>
 *     propagation.extract(context.active(), { traceparent }),
 *
 *   withContext: (ctx, fn) => context.with(ctx, fn),
 *
 *   getActiveSpan: () => trace.getActiveSpan(),
 *
 *   setAttributes: (span, attrs) => {
 *     for (const [key, value] of Object.entries(attrs)) {
 *       span?.setAttribute(key, value);
 *     }
 *   },
 *
 *   recordException: (span, error) => span?.recordException(error),
 * };
 * ```
 */
export interface TelemetryHooks {
	/**
	 * Extract trace context from a traceparent header string.
	 * @param traceparent - W3C trace context traceparent header
	 * @returns Extracted context for use with withContext
	 */
	extractTraceContext?: (traceparent: string) => TraceContext;

	/**
	 * Execute a function within a trace context.
	 * @param ctx - Context from extractTraceContext
	 * @param fn - Function to execute within the context
	 * @returns The result of the function
	 */
	withContext?: <T>(ctx: TraceContext, fn: () => T) => T;

	/**
	 * Get the currently active span.
	 * @returns The active span or undefined
	 */
	getActiveSpan?: () => SpanLike | undefined;

	/**
	 * Set attributes on a span.
	 * @param span - The span to set attributes on
	 * @param attributes - Key-value pairs to set
	 */
	setAttributes?: (
		span: SpanLike | undefined,
		attributes: Record<string, string | number | boolean>,
	) => void;

	/**
	 * Record an exception on a span.
	 * @param span - The span to record the exception on
	 * @param error - The error to record
	 */
	recordException?: (span: SpanLike | undefined, error: Error) => void;
}
