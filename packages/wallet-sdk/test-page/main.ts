import { base64, hex } from "@scure/base";
import type { RequestMessage } from "../src/types/wallet";
import { WalletWebAuthnP256 } from "../src/wallet-contract";
import { DomainId, MpcContract } from "../src/mpc-contract";
import { OneClickClient } from "../src/oneclick-client";

function getInput(id: string): HTMLInputElement {
	const element = document.getElementById(id);
	if (!(element instanceof HTMLInputElement)) {
		throw new Error(`Element #${id} is not an input`);
	}
	return element;
}

function getSelect(id: string): HTMLSelectElement {
	const element = document.getElementById(id);
	if (!(element instanceof HTMLSelectElement)) {
		throw new Error(`Element #${id} is not a select`);
	}
	return element;
}

function getTextarea(id: string): HTMLTextAreaElement {
	const element = document.getElementById(id);
	if (!(element instanceof HTMLTextAreaElement)) {
		throw new Error(`Element #${id} is not a textarea`);
	}
	return element;
}

function getButton(id: string): HTMLButtonElement {
	const element = document.getElementById(id);
	if (!(element instanceof HTMLButtonElement)) {
		throw new Error(`Element #${id} is not a button`);
	}
	return element;
}

function getDiv(id: string): HTMLDivElement {
	const element = document.getElementById(id);
	if (!(element instanceof HTMLDivElement)) {
		throw new Error(`Element #${id} is not a div`);
	}
	return element;
}

const $baseUrl = getInput("baseUrl");
const $authToken = getTextarea("authToken");
const $connectBtn = getButton("connectBtn");
const $connectOutput = getDiv("connectOutput");

const $publicKey = getInput("publicKey");
const $createPasskey = getButton("createPasskey");
const $setupOutput = getDiv("setupOutput");
const $accountIdOutput = getDiv("accountIdOutput");
const $secp256k1Output = getDiv("secp256k1Output");
const $ed25519Output = getDiv("ed25519Output");

const $payload = getInput("payload");
const $domainId = getSelect("domainId");
const $deadlineSec = getInput("deadlineSec");
const $prepareBtn = getButton("prepareBtn");
const $prepareOutput = getDiv("prepareOutput");

const $signBtn = getButton("signBtn");
const $signOutput = getDiv("signOutput");

const $sendBtn = getButton("sendBtn");
const $sendOutput = getDiv("sendOutput");

let client: OneClickClient | null = null;
let credentialId: ArrayBuffer | null = null;
let wallet!: WalletWebAuthnP256;

// Disable all steps until connected
$createPasskey.disabled = true;
let currentMessage: RequestMessage | null = null;
let currentChallenge: string | null = null;
let currentProof: string | null = null;

function showOutput(
	element: HTMLDivElement,
	text: string,
	type: "error" | "success" | "info",
): void {
	element.hidden = false;
	element.textContent = text;
	element.className = "output";
	element.classList.add(type);
}

function extractP256PublicKeyHex(spki: ArrayBuffer): string {
	const bytes = new Uint8Array(spki);
	const spkiHeaderLength = 26;
	const uncompressedLength = 65;

	if (
		bytes.length === spkiHeaderLength + uncompressedLength &&
		bytes[spkiHeaderLength] === 0x04
	) {
		return hex.encode(bytes.slice(spkiHeaderLength));
	}

	if (bytes.length === uncompressedLength && bytes[0] === 0x04) {
		return hex.encode(bytes);
	}

	throw new Error(
		`Unexpected public key format (${bytes.length} bytes). Expected P-256 SPKI or uncompressed point.`,
	);
}

function parseDomainId(value: string): DomainId {
	switch (value) {
		case "Secp256k1":
			return DomainId.Secp256k1;
		case "Ed25519":
			return DomainId.Ed25519;
		default:
			throw new Error(`Unsupported domain ID value: ${value}`);
	}
}

$connectBtn.addEventListener("click", () => {
	const baseUrl = $baseUrl.value.trim();
	if (!baseUrl) {
		showOutput($connectOutput, "Base URL is required", "error");
		return;
	}

	client = new OneClickClient({
		baseUrl,
		authToken: $authToken.value.trim() || undefined,
	});

	$createPasskey.disabled = false;
	$connectBtn.disabled = true;
	$baseUrl.disabled = true;
	$authToken.disabled = true;

	showOutput($connectOutput, `Connected to ${baseUrl}`, "success");
});

$createPasskey.addEventListener("click", async () => {
	try {
		const created = await navigator.credentials.create({
			publicKey: {
				challenge: crypto.getRandomValues(new Uint8Array(32)),
				rp: { name: "Wallet SDK Test" },
				user: {
					id: crypto.getRandomValues(new Uint8Array(16)),
					name: "wallet-sdk-user",
					displayName: "Wallet SDK User",
				},
				pubKeyCredParams: [{ alg: -7, type: "public-key" }],
				authenticatorSelection: {
					authenticatorAttachment: "platform",
					residentKey: "preferred",
					userVerification: "preferred",
				},
				attestation: "none",
			},
		});

		if (!(created instanceof PublicKeyCredential)) {
			throw new Error("Passkey creation returned invalid credential");
		}

		const response = created.response;
		if (!(response instanceof AuthenticatorAttestationResponse)) {
			throw new Error("Unexpected attestation response type");
		}

		if (typeof response.getPublicKey !== "function") {
			throw new Error(
				"Browser does not expose getPublicKey() on attestation response",
			);
		}

		const spki = response.getPublicKey();
		if (!spki) {
			throw new Error("Passkey did not return a public key");
		}

		credentialId = created.rawId;
		const publicKeyHex = extractP256PublicKeyHex(spki);
		$publicKey.value = publicKeyHex;

		if (!client) {
			throw new Error("Connect to relayer first");
		}
		wallet = new WalletWebAuthnP256(client, publicKeyHex);

		showOutput(
			$setupOutput,
			`Passkey created\nCredential ID: ${hex.encode(new Uint8Array(created.rawId))}\nPublic Key: ${publicKeyHex}`,
			"success",
		);

		const accountId = wallet.deriveAccountId();
		showOutput($accountIdOutput, accountId, "info");

		showOutput($secp256k1Output, "Deriving...", "info");
		showOutput($ed25519Output, "Deriving...", "info");

		const [secp256k1Key, ed25519Key] = await Promise.all([
			wallet.derivePublicKey("", DomainId.Secp256k1),
			wallet.derivePublicKey("", DomainId.Ed25519),
		]);

		showOutput($secp256k1Output, secp256k1Key, "success");
		showOutput($ed25519Output, ed25519Key, "success");
	} catch (error) {
		showOutput(
			$setupOutput,
			`Error: ${error instanceof Error ? error.message : String(error)}`,
			"error",
		);
	}
});

$prepareBtn.addEventListener("click", async () => {
	try {
		const publicKey = $publicKey.value.trim();
		if (!publicKey) {
			throw new Error("Public key is required");
		}

		const payload = $payload.value;
		const deadline = Number.parseInt($deadlineSec.value, 10);

		if (Number.isNaN(deadline) || deadline <= 0) {
			throw new Error("Deadline must be a positive integer");
		}

		const mpcContract = new MpcContract();
		const request = mpcContract.buildSignMpcRequest(
			parseDomainId($domainId.value),
			hex.decode(payload),
		);
		const message = await wallet.buildRequestMessage(request, deadline);
		const challenge = wallet.challenge(message);
		const accountId = wallet.deriveAccountId();

		currentMessage = message;
		currentChallenge = challenge;
		currentProof = null;
		$sendBtn.disabled = true;

		if (credentialId) {
			$signBtn.disabled = false;
		} else {
			$signBtn.disabled = true;
			showOutput(
				$setupOutput,
				"Create passkey first to sign challenge with WebAuthn.",
				"info",
			);
		}

		showOutput(
			$prepareOutput,
			[
				`Account ID: ${accountId}`,
				`Challenge (base64): ${challenge}`,
				`Message: ${JSON.stringify(message, null, 2)}`,
			].join("\n\n"),
			"success",
		);
	} catch (error) {
		showOutput(
			$prepareOutput,
			`Error: ${error instanceof Error ? error.message : String(error)}`,
			"error",
		);
	}
});

$signBtn.addEventListener("click", async () => {
	try {
		if (!wallet) {
			throw new Error("Prepare payload first");
		}
		if (!currentChallenge) {
			throw new Error("Missing challenge. Run prepare flow first");
		}
		if (!credentialId) {
			throw new Error("No passkey credential found. Create passkey first");
		}

		const got = await navigator.credentials.get({
			publicKey: {
				challenge: base64.decode(currentChallenge),
				allowCredentials: [
					{
						id: credentialId,
						type: "public-key",
						transports: ["internal"],
					},
				],
				userVerification: "preferred",
			},
		});

		if (!(got instanceof PublicKeyCredential)) {
			throw new Error(
				"WebAuthn signing did not return a public key credential",
			);
		}

		const response = got.response;
		if (!(response instanceof AuthenticatorAssertionResponse)) {
			throw new Error("Unexpected assertion response type");
		}

		const proof = wallet.buildProof(response);

		currentProof = proof;
		$sendBtn.disabled = false;

		showOutput(
			$signOutput,
			`Proof:\n${JSON.stringify(JSON.parse(proof), null, 2)}`,
			"success",
		);
	} catch (error) {
		showOutput(
			$signOutput,
			`Error: ${error instanceof Error ? error.message : String(error)}`,
			"error",
		);
	}
});

$sendBtn.addEventListener("click", async () => {
	try {
		if (!wallet) {
			throw new Error("Prepare payload first");
		}
		if (!currentMessage || !currentProof) {
			throw new Error("Prepare and sign first");
		}

		showOutput($sendOutput, "Sending request...", "info");

		const start = performance.now();
		const { status, body } = await wallet.sendSign({
			message: currentMessage,
			proof: currentProof,
		});
		const duration = Math.round(performance.now() - start);

		const resultType = status >= 200 && status < 300 ? "success" : "error";
		showOutput(
			$sendOutput,
			`Status: ${status} (${duration}ms)\n\nResponse:\n${body}`,
			resultType,
		);
	} catch (error) {
		showOutput(
			$sendOutput,
			`Error: ${error instanceof Error ? error.message : String(error)}`,
			"error",
		);
	}
});
