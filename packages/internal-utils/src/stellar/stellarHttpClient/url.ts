/**
 * Builds a Horizon request URL by appending `path` to `baseURL`.
 *
 * `path` is appended to the pathname rather than resolved as a relative URL,
 * because resolving drops the last path segment of a `baseURL` without a
 * trailing slash, as well as its query params (e.g. `?api_key=...`).
 */
export function buildHorizonUrl(baseURL: string, path: string): URL {
	const url = new URL(baseURL);
	url.pathname = `${url.pathname.replace(/\/+$/, "")}/${path}`;
	return url;
}
