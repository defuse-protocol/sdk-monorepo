import { BaseError } from "@defuse-protocol/internal-utils";

export type DestinationNearAccountDoesntExistErrorType =
	DestinationNearAccountDoesntExistError & {
		name: "DestinationNearAccountDoesntExistError";
	};
export class DestinationNearAccountDoesntExistError extends BaseError {
	constructor(public accountId: string) {
		super("Destination NEAR account doesn't exist.", {
			metaMessages: [`Account Id: ${accountId}`],
			name: "DestinationNearAccountDoesntExistError",
		});
	}
}
