import type { Salt } from "../expirable-nonce";

export interface ISaltManager {
	getCachedSalt(): Promise<Salt>;
	refresh(): Promise<Salt>;
}
