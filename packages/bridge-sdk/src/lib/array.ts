import { assert } from "./assert";

export function drop<T>(arr: T[], indexes: number[]): T[] {
	const result: T[] = [];
	for (let i = 0; i < arr.length; i++) {
		if (!indexes.includes(i)) {
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			result.push(arr[i]!);
		}
	}
	return result;
}

export function zip<T, S>(arr1: T[], arr2: S[]): [T, S][] {
	assert(arr1.length === arr2.length, "Arrays must have the same length");
	// biome-ignore lint/style/noNonNullAssertion: <explanation>
	return arr1.map((v, i) => [v, arr2[i]!]);
}

export function zip3<T, S, K>(arr1: T[], arr2: S[], arr3: K[]): [T, S, K][] {
	assert(
		arr1.length === arr2.length && arr2.length === arr3.length,
		"Arrays must have the same length",
	);
	// biome-ignore lint/style/noNonNullAssertion: <explanation>
	return arr1.map((v, i) => [v, arr2[i]!, arr3[i]!]);
}
