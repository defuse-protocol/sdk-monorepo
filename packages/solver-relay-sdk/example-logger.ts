const LEVELS = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
} as const;

type Level = keyof typeof LEVELS;

const COLORS: Record<Level, string> = {
	debug: "\x1b[90m", // gray
	info: "\x1b[36m", // cyan
	warn: "\x1b[33m", // yellow
	error: "\x1b[31m", // red
};

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

function formatStructured(data: Record<string, unknown>): string {
	return Object.entries(data)
		.map(([k, v]) => `${DIM}${k}=${RESET}${String(v)}`)
		.join(" ");
}

function formatTimestamp(): string {
	return `${DIM}${new Date().toISOString()}${RESET}`;
}

function createLogFn(level: Level, minLevel: number) {
	const priority = LEVELS[level];
	const color = COLORS[level];
	const tag = `${color}${BOLD}${level.toUpperCase().padEnd(5)}${RESET}`;
	const write =
		// biome-ignore lint/suspicious/noConsole: this is a logger
		level === "error" || level === "warn" ? console.error : console.log;

	return (message: string, data?: Record<string, unknown>) => {
		if (priority < minLevel) return;
		const parts = [formatTimestamp(), tag, message];
		if (data) parts.push(formatStructured(data));
		write(parts.join(" "));
	};
}

export function createLogger(level: Level = "info") {
	const min = LEVELS[level];
	return {
		debug: createLogFn("debug", min),
		info: createLogFn("info", min),
		warn: createLogFn("warn", min),
		error: createLogFn("error", min),
	};
}
