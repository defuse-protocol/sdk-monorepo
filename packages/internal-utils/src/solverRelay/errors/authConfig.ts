export const SOLVER_RELAY_AUTH_CONFIG_ERROR_MESSAGE =
	"solverRelayApiKey or Authorization header is required for solver-relay JSON-RPC requests";

export class SolverRelayAuthConfigError extends Error {
	name = "SolverRelayAuthConfigError" as const;

	constructor() {
		super(SOLVER_RELAY_AUTH_CONFIG_ERROR_MESSAGE);
	}
}
