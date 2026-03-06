export class OneClickClient {
	private readonly baseUrl: string;
	private readonly authToken: string | undefined;

	constructor(opts: { baseUrl: string; authToken?: string }) {
		this.baseUrl = opts.baseUrl;
		this.authToken = opts.authToken;
	}

	async sign(body: {
		msg: unknown;
		proof: string;
		stateInit: unknown;
	}): Promise<{ status: number; body: string }> {
		const res = await this.post("/v0/sign", body);
		const text = await res.text();
		return { status: res.status, body: text };
	}

	async derivePublicKey(body: {
		path: string;
		domainId: string;
		predecessor: string;
	}): Promise<string> {
		const res = await this.post("/v0/derive-public-key", body);
		return await res.text();
	}

	private async post(path: string, body: unknown): Promise<Response> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (this.authToken) {
			headers.Authorization = `Bearer ${this.authToken}`;
		}
		return fetch(`${this.baseUrl}${path}`, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
		});
	}
}
