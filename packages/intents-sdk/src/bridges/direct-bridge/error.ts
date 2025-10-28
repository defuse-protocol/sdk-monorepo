import { BaseError } from "@defuse-protocol/internal-utils";

export type DestinationExplicitNearAccountDoesntExistErrorType =
	DestinationExplicitNearAccountDoesntExistError & {
		name: "DestinationExplicitNearAccountDoesntExistError";
	};
export class DestinationExplicitNearAccountDoesntExistError extends BaseError {
	constructor(public accountId: string) {
		super("Destination explicit NEAR account doesn't exist.", {
			metaMessages: [`Account Id: ${accountId}`],
			name: "DestinationExplicitNearAccountDoesntExistError",
		});
	}
}
