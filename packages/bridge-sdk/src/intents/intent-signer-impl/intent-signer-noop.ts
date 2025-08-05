import type { IIntentSigner } from "../interfaces/intent-signer";

export const noopIntentSigner: IIntentSigner = {
	signIntent() {
		throw new Error("Not implemented");
	},
};
