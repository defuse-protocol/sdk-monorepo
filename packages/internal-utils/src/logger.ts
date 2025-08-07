type Context = Record<string, unknown>;

export interface ILogger
	extends Pick<typeof console, "error" | "warn" | "info" | "debug" | "trace"> {
	error(msg: string | Error, ctx?: Context): void;
	warn(msg: string, ctx?: Context): void;
	info(msg: string, ctx?: Context): void;
	debug(msg: string, ctx?: Context): void;
	trace(msg: string, ctx?: Context): void;
}
