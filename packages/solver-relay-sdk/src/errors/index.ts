import ModernError from "modern-errors";

export const SolverRelayError = ModernError.subclass("SolverRelayError");

export type SolverRelayErrorInstance = InstanceType<typeof SolverRelayError>;

export const RelayRpcError = SolverRelayError.subclass("RelayRpcError", {
	props: {} as { code: number; data: unknown },
});

export const RequestTimeoutError = SolverRelayError.subclass(
	"RequestTimeoutError",
	{
		props: {} as { method: string; timeoutMs: number },
	},
);

export const ConnectionError = SolverRelayError.subclass("ConnectionError");

export const ValidationError = SolverRelayError.subclass("ValidationError");

export const UnexpectedError = SolverRelayError.subclass("UnexpectedError");

export function toSolverRelayError(error: unknown): SolverRelayErrorInstance {
	if (error instanceof SolverRelayError) return error;
	return new UnexpectedError("Unexpected error", { cause: error });
}
