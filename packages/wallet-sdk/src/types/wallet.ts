import type { GlobalContractId } from "./state";

/// A single outgoing receipt
export type NearPromise = {
	/// Receiver of the receipt to be created.
	///
	/// NOTE: self-calls are prohibited.
	receiver_id: string;

	/// Receiver for refunds of failed or unused deposits.
	/// By default, it's the wallet-contract itself.
	refund_to?: string;

	/// Empty actions is no-op.
	actions: PromiseAction[];
};

export type Request = {
	internal: WalletOp[];
	external: NearPromise[];
};

export type RequestMessage = {
	chain_id: "mainnet" | "testnet";
	signer_id: string;
	nonce: number;
	created_at: string;
	timeout_secs: number;
	request: Request;
};

export type WalletOp =
	| { op: "set_signature_mode"; payload: { enable: boolean } }
	| { op: "add_extension"; payload: { account_id: string } }
	| { op: "remove_extension"; payload: { account_id: string } };

// todo borsch schema
export type FunctionCallAction = {
	action: "function_call";
	payload: {
		function_name: string;
		/** Base64-encoded JSON bytes (NEAR Base64VecU8 convention). */
		args?: string;
		// todo u128
		deposit?: string;
		gas?: string;
		gas_weight?: string;
	};
};

export type TransferAction = {
	action: "transfer";
	payload: {
		amount: string;
	};
};

export type DeterministicStateInitAction = {
	action: "deterministic_state_init";
	payload: {
		state_init: StateInit;
		deposit?: string;
	};
};

export type StateInit = { V1: StateInitV1 };

type StateInitV1 = {
	code: GlobalContractId;
	data: Map<number[], number[]>;
};

/// NOTE: there is no support for other actions, since they operate on the
/// account itself (e.g. DeployContract, AddKey and etc...) or its on subaccounts
/// (e.g. CreateAccount). Wallet-contracts are not self-upgradable and do
/// not allow creating subaccounts.
export type PromiseAction =
	| FunctionCallAction
	| TransferAction
	| DeterministicStateInitAction;

export type PromiseSingle = NearPromise;
