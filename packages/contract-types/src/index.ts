/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "Intent".
 */
export type Intent =
	| {
			intent: "add_public_key";
			public_key: string;
			[k: string]: unknown;
	  }
	| {
			intent: "remove_public_key";
			public_key: string;
			[k: string]: unknown;
	  }
	| {
			intent: "invalidate_nonces";
			nonces: string[];
			[k: string]: unknown;
	  }
	| {
			intent: "transfer";
			memo?: string | null;
			receiver_id: AccountId;
			tokens: {
				[k: string]: string;
			};
			[k: string]: unknown;
	  }
	| {
			amount: string;
			intent: "ft_withdraw";
			memo?: string | null;
			/**
			 * Message to pass to `ft_transfer_call`. Otherwise, `ft_transfer` will be used. NOTE: No refund will be made in case of insufficient `storage_deposit` on `token` for `receiver_id`
			 */
			msg?: string | null;
			receiver_id: AccountId;
			/**
			 * Optionally make `storage_deposit` for `receiver_id` on `token`. The amount will be subtracted from user's NEP-141 `wNEAR` balance. NOTE: the `wNEAR` will not be refunded in case of fail
			 */
			storage_deposit?: string | null;
			token: AccountId;
			[k: string]: unknown;
	  }
	| {
			intent: "nft_withdraw";
			memo?: string | null;
			/**
			 * Message to pass to `nft_transfer_call`. Otherwise, `nft_transfer` will be used. NOTE: No refund will be made in case of insufficient `storage_deposit` on `token` for `receiver_id`
			 */
			msg?: string | null;
			receiver_id: AccountId;
			/**
			 * Optionally make `storage_deposit` for `receiver_id` on `token`. The amount will be subtracted from user's NEP-141 `wNEAR` balance. NOTE: the `wNEAR` will not be refunded in case of fail
			 */
			storage_deposit?: string | null;
			token: AccountId;
			token_id: string;
			[k: string]: unknown;
	  }
	| {
			amounts: string[];
			intent: "mt_withdraw";
			memo?: string | null;
			/**
			 * Message to pass to `mt_batch_transfer_call`. Otherwise, `mt_batch_transfer` will be used. NOTE: No refund will be made in case of insufficient `storage_deposit` on `token` for `receiver_id`
			 */
			msg?: string | null;
			receiver_id: AccountId;
			/**
			 * Optionally make `storage_deposit` for `receiver_id` on `token`. The amount will be subtracted from user's NEP-141 `wNEAR` balance. NOTE: the `wNEAR` will not be refunded in case of fail
			 */
			storage_deposit?: string | null;
			token: AccountId;
			token_ids: string[];
			[k: string]: unknown;
	  }
	| {
			amount: string;
			intent: "native_withdraw";
			receiver_id: AccountId;
			[k: string]: unknown;
	  }
	| {
			account_id: AccountId;
			amount: string;
			contract_id: AccountId;
			intent: "storage_deposit";
			[k: string]: unknown;
	  }
	| {
			diff: {
				[k: string]: string;
			};
			intent: "token_diff";
			memo?: string | null;
			referral?: AccountId | null;
			[k: string]: unknown;
	  };
/**
 * NEAR Account Identifier.
 *
 * This is a unique, syntactically valid, human-readable account identifier on the NEAR network.
 *
 * [See the crate-level docs for information about validation.](index.html#account-id-rules)
 *
 * Also see [Error kind precedence](AccountId#error-kind-precedence).
 *
 * ## Examples
 *
 * ``` use near_account_id::AccountId;
 *
 * let alice: AccountId = "alice.near".parse().unwrap();
 *
 * assert!("ƒelicia.near".parse::<AccountId>().is_err()); // (ƒ is not f) ```
 *
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "AccountId".
 */
export type AccountId = string;
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "Deadline".
 */
export type Deadline = string;
/**
 * Account identifier. This is the human readable UTF-8 string which is used internally to index accounts on the network and their respective state.
 *
 * This is the "referenced" version of the account ID. It is to [`AccountId`] what [`str`] is to [`String`], and works quite similarly to [`Path`]. Like with [`str`] and [`Path`], you can't have a value of type `AccountIdRef`, but you can have a reference like `&AccountIdRef` or `&mut AccountIdRef`.
 *
 * This type supports zero-copy deserialization offered by [`serde`](https://docs.rs/serde/), but cannot do the same for [`borsh`](https://docs.rs/borsh/) since the latter does not support zero-copy.
 *
 * # Examples ``` use near_account_id::{AccountId, AccountIdRef}; use std::convert::{TryFrom, TryInto};
 *
 * // Construction let alice = AccountIdRef::new("alice.near").unwrap(); assert!(AccountIdRef::new("invalid.").is_err()); ```
 *
 * [`FromStr`]: std::str::FromStr [`Path`]: std::path::Path
 *
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "AccountIdRef".
 */
export type AccountIdRef = string;
/**
 * 1 pip == 1/100th of bip == 0.0001%
 *
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "Pips".
 */
export type Pips = number;
/**
 * See [ERC-191](https://github.com/ethereum/ercs/blob/master/ERCS/erc-191.md)
 *
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "Erc191Payload".
 */
export type Erc191Payload = string;
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "InvariantViolated".
 */
export type InvariantViolated =
	| {
			error: "unmatched_deltas";
			unmatched_deltas: {
				[k: string]: string;
			};
			[k: string]: unknown;
	  }
	| {
			error: "overflow";
			[k: string]: unknown;
	  };
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "MultiPayload".
 */
export type MultiPayload =
	| {
			payload: Nep413Payload;
			public_key: string;
			signature: string;
			standard: "nep413";
			[k: string]: unknown;
	  }
	| {
			payload: Erc191Payload;
			signature: string;
			standard: "erc191";
			[k: string]: unknown;
	  }
	| {
			payload: string;
			public_key: string;
			signature: string;
			standard: "raw_ed25519";
			[k: string]: unknown;
	  }
	| {
			public_key: string;
			signature: string;
			[k: string]: unknown;
	  }
	| {
			/**
			 * Wallet address in either [Raw](https://docs.ton.org/learn/overviews/addresses#raw-address) representation or [user-friendly](https://docs.ton.org/learn/overviews/addresses#user-friendly-address) format
			 */
			address: string;
			/**
			 * dApp domain
			 */
			domain: string;
			payload: TonConnectPayloadSchema;
			public_key: string;
			signature: string;
			standard: "ton_connect";
			/**
			 * UNIX timestamp (in seconds or RFC3339) at the time of singing
			 */
			timestamp: PickFirstDateTimeint64;
			[k: string]: unknown;
	  };
/**
 * See <https://docs.tonconsole.com/academy/sign-data#choosing-the-right-format>
 *
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "TonConnectPayloadSchema".
 */
export type TonConnectPayloadSchema =
	| {
			text: string;
			type: "text";
			[k: string]: unknown;
	  }
	| {
			bytes: string;
			type: "binary";
			[k: string]: unknown;
	  }
	| {
			cell: string;
			schema_crc: number;
			type: "cell";
			[k: string]: unknown;
	  };
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "PickFirst(DateTimeint64)".
 */
export type PickFirstDateTimeint64 = string | number;
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "PromiseOrValueArray_of_String".
 */
export type PromiseOrValueArrayOf_String = string[];
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "PromiseOrValueBoolean".
 */
export type PromiseOrValueBoolean = boolean;
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "PromiseOrValueString".
 */
export type PromiseOrValueString = string;

export interface DefuseContractABI {
	[k: string]: unknown;
}
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "AbiHelper".
 */
export interface AbiHelper {
	intent: Intent;
	payload: AbiPayloadHelper;
	[k: string]: unknown;
}
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "AbiPayloadHelper".
 */
export interface AbiPayloadHelper {
	defuse: DefusePayloadFor_DefuseIntents;
	nep413: Nep413DefuseMessageFor_DefuseIntents;
	[k: string]: unknown;
}
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "DefusePayload_for_DefuseIntents".
 */
export interface DefusePayloadFor_DefuseIntents {
	deadline: Deadline;
	/**
	 * Sequence of intents to execute in given order. Empty list is also a valid sequence, i.e. it doesn't do anything, but still invalidates the `nonce` for the signer WARNING: Promises created by different intents are executed concurrently and does not rely on the order of the intents in this structure
	 */
	intents?: Intent[];
	nonce: string;
	signer_id: AccountId;
	verifying_contract: AccountId;
	[k: string]: unknown;
}
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "Nep413DefuseMessage_for_DefuseIntents".
 */
export interface Nep413DefuseMessageFor_DefuseIntents {
	deadline: Deadline;
	/**
	 * Sequence of intents to execute in given order. Empty list is also a valid sequence, i.e. it doesn't do anything, but still invalidates the `nonce` for the signer WARNING: Promises created by different intents are executed concurrently and does not rely on the order of the intents in this structure
	 */
	intents?: Intent[];
	signer_id: AccountId;
	[k: string]: unknown;
}
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "DefuseConfig".
 */
export interface DefuseConfig {
	fees: FeesConfig;
	roles: RolesConfig;
	wnear_id: AccountId;
	[k: string]: unknown;
}
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "FeesConfig".
 */
export interface FeesConfig {
	fee: Pips;
	fee_collector: AccountId;
	[k: string]: unknown;
}
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "RolesConfig".
 */
export interface RolesConfig {
	admins: {
		[k: string]: AccountId[];
	};
	grantees: {
		[k: string]: AccountId[];
	};
	super_admins: AccountId[];
	[k: string]: unknown;
}
/**
 * Withdraw given FT tokens from the intents contract to a given external account id (external being outside of intents).
 *
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "FtWithdraw".
 */
export interface FtWithdraw {
	amount: string;
	memo?: string | null;
	/**
	 * Message to pass to `ft_transfer_call`. Otherwise, `ft_transfer` will be used. NOTE: No refund will be made in case of insufficient `storage_deposit` on `token` for `receiver_id`
	 */
	msg?: string | null;
	receiver_id: AccountId;
	/**
	 * Optionally make `storage_deposit` for `receiver_id` on `token`. The amount will be subtracted from user's NEP-141 `wNEAR` balance. NOTE: the `wNEAR` will not be refunded in case of fail
	 */
	storage_deposit?: string | null;
	token: AccountId;
	[k: string]: unknown;
}
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "IntentEvent_for_AccountEvent_for_Null".
 */
export interface IntentEventFor_AccountEventFor_Null {
	account_id: AccountIdRef;
	intent_hash: string;
	[k: string]: unknown;
}
/**
 * Withdraw given MT tokens (i.e. [NEP-245](https://github.com/near/NEPs/blob/master/neps/nep-0245.md)) from the intents contract to a given to an external account id (external being outside of intents).
 *
 * If `msg` is given, `mt_batch_transfer_call()` will be used to transfer to the `receiver_id`. Otherwise, `mt_batch_transfer()` will be used.
 *
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "MtWithdraw".
 */
export interface MtWithdraw {
	amounts: string[];
	memo?: string | null;
	/**
	 * Message to pass to `mt_batch_transfer_call`. Otherwise, `mt_batch_transfer` will be used. NOTE: No refund will be made in case of insufficient `storage_deposit` on `token` for `receiver_id`
	 */
	msg?: string | null;
	receiver_id: AccountId;
	/**
	 * Optionally make `storage_deposit` for `receiver_id` on `token`. The amount will be subtracted from user's NEP-141 `wNEAR` balance. NOTE: the `wNEAR` will not be refunded in case of fail
	 */
	storage_deposit?: string | null;
	token: AccountId;
	token_ids: string[];
	[k: string]: unknown;
}
/**
 * See [NEP-413](https://github.com/near/NEPs/blob/master/neps/nep-0413.md)
 *
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "Nep413Payload".
 */
export interface Nep413Payload {
	callbackUrl?: string | null;
	message: string;
	nonce: string;
	recipient: string;
	[k: string]: unknown;
}
/**
 * Withdraw native tokens (NEAR) from the intents contract to a given external account id (external being outside of intents). This will subtract from the account's wNEAR balance, and will be sent to the account specified as native NEAR. NOTE: the `wNEAR` will not be refunded in case of fail (e.g. `receiver_id` account does not exist).
 *
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "NativeWithdraw".
 */
export interface NativeWithdraw {
	amount: string;
	receiver_id: AccountId;
	[k: string]: unknown;
}
/**
 * Withdraw given NFT tokens from the intents contract to a given external account id (external being outside of intents).
 *
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "NftWithdraw".
 */
export interface NftWithdraw {
	memo?: string | null;
	/**
	 * Message to pass to `nft_transfer_call`. Otherwise, `nft_transfer` will be used. NOTE: No refund will be made in case of insufficient `storage_deposit` on `token` for `receiver_id`
	 */
	msg?: string | null;
	receiver_id: AccountId;
	/**
	 * Optionally make `storage_deposit` for `receiver_id` on `token`. The amount will be subtracted from user's NEP-141 `wNEAR` balance. NOTE: the `wNEAR` will not be refunded in case of fail
	 */
	storage_deposit?: string | null;
	token: AccountId;
	token_id: string;
	[k: string]: unknown;
}
/**
 * Collects super admin accounts and accounts that have been granted permissions defined by `AccessControlRole`.
 *
 * # Data structure
 *
 * Assume `AccessControlRole` is derived for the following enum, which is then passed as `role` attribute to `AccessControllable`.
 *
 * ```rust pub enum Role { PauseManager, UnpauseManager, } ```
 *
 * Then the returned data has the following structure:
 *
 * ```ignore PermissionedAccounts { super_admins: vec!["acc1.near", "acc2.near"], roles: HashMap::from([ ("PauseManager", PermissionedAccountsPerRole { admins: vec!["acc3.near", "acc4.near"], grantees: vec!["acc5.near", "acc6.near"], }), ("UnpauseManager", PermissionedAccountsPerRole { admins: vec!["acc7.near", "acc8.near"], grantees: vec!["acc9.near", "acc10.near"], }), ]) } ```
 *
 * # Uniqueness and ordering
 *
 * Account ids returned in vectors are unique but not ordered.
 *
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "PermissionedAccounts".
 */
export interface PermissionedAccounts {
	/**
	 * The admins and grantees of all roles.
	 */
	roles: {
		[k: string]: PermissionedAccountsPerRole;
	};
	/**
	 * The accounts that have super admin permissions.
	 */
	super_admins: AccountId[];
	[k: string]: unknown;
}
/**
 * Collects all admins and grantees of a role.
 *
 * # Uniqueness and ordering
 *
 * Account ids returned in vectors are unique but not ordered.
 *
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "PermissionedAccountsPerRole".
 */
export interface PermissionedAccountsPerRole {
	/**
	 * The accounts that have admin permissions for the role.
	 */
	admins: AccountId[];
	/**
	 * The accounts that have been granted the role.
	 */
	grantees: AccountId[];
	[k: string]: unknown;
}
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "SimulationOutput".
 */
export interface SimulationOutput {
	/**
	 * Intent hashes along with corresponding signers
	 */
	intents_executed: IntentEventFor_AccountEventFor_Null[];
	/**
	 * Unmatched token deltas needed to keep the invariant. If not empty, can be used along with fee to calculate `token_diff` closure.
	 */
	invariant_violated?: InvariantViolated | null;
	/**
	 * Minimum deadline among all simulated intents
	 */
	min_deadline: Deadline;
	/**
	 * Additional info about current state
	 */
	state: StateOutput;
	[k: string]: unknown;
}
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "StateOutput".
 */
export interface StateOutput {
	fee: Pips;
	[k: string]: unknown;
}
/**
 * Make [NEP-145](https://nomicon.io/Standards/StorageManagement#nep-145) `storage_deposit` for an `account_id` on `contract_id`. The `amount` will be subtracted from user's NEP-141 `wNEAR` balance. NOTE: the `wNEAR` will not be refunded in any case.
 *
 * WARNING: use this intent only if paying storage_deposit is not a prerequisite for other intents to succeed. If some intent (e.g. ft_withdraw) requires storage_deposit, then use storage_deposit field of corresponding intent instead of adding a separate `StorageDeposit` intent. This is due to the fact that intents that fire `Promise`s are not guaranteed to be executed sequentially, in the order of the provided intents in `DefuseIntents`.
 *
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "StorageDeposit".
 */
export interface StorageDeposit {
	account_id: AccountId;
	amount: string;
	contract_id: AccountId;
	[k: string]: unknown;
}
/**
 * This interface was referenced by `DefuseContractABI`'s JSON-Schema
 * via the `definition` "Token".
 */
export interface Token {
	owner_id?: AccountId | null;
	token_id: string;
	[k: string]: unknown;
}
