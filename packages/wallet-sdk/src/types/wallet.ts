import type { GlobalContractId } from "./state";

/// A single outgoing receipt
export type PromiseSingle = {
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
	ops: WalletOp[];
	out: PromiseDag;
};
/// DAG of promises to execute
export type PromiseDag = {
	/// `PromiseDAG`s to be executed before `promises`, if any.
	after: PromiseDag[];
	/// Promises to be executed concurrently after `after`, if any.
	then: PromiseSingle[];
};

export type RequestMessage = {
	chain_id: "mainnet" | "testnet";
	signer_id: string;
	seqno: number;
	valid_until: string;
	request: Request;
};

export type WalletOp =
	| { op: "set_signature_mode"; enable: boolean }
	| { op: "add_extension"; account_id: string }
	| { op: "remove_extension"; account_id: string }
	| { op: "custom"; args: number[] };

// todo borsch schema
export type FunctionCallAction = {
	action: "function_call";
	function_name: string;
	/** Base64-encoded JSON bytes (NEAR Base64VecU8 convention). */
	args: string;
	// todo u128
	deposit: string;
	min_gas?: string;
	gas_weight?: string;
};

export type TransferAction = {
	action: "transfer";
	amount: string;
};

export type StateInitAction = {
	action: "state_init";
	state_init: StateInit;
	deposit: string;
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
	| StateInitAction;

export type ProofParams = {
	authenticatorData: string;
	clientDataJSON: ArrayBuffer;
	signature: string;
	publicKey: string;
};
