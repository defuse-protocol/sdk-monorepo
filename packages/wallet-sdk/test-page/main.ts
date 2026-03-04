import {base64, hex} from "@scure/base";
import type {RequestMessage} from "../src";
import {WalletContract} from "../src";
import {Blockchain} from "../src/promise-single";

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

const $publicKey = getInput("publicKey");
const $createPasskey = getButton("createPasskey");
const $setupOutput = getDiv("setupOutput");

const $payload = getInput("payload");
const $seqno = getInput("seqno");
const $blockchain = getSelect("blockchain");
const $deadlineSec = getInput("deadlineSec");
const $prepareBtn = getButton("prepareBtn");
const $prepareOutput = getDiv("prepareOutput");

const $signBtn = getButton("signBtn");
const $signOutput = getDiv("signOutput");

const $baseUrl = getInput("baseUrl");
const $authToken = getTextarea("authToken");
const $sendBtn = getButton("sendBtn");
const $sendOutput = getDiv("sendOutput");

let credentialId: ArrayBuffer | null = null;
let wallet: WalletContract | null = null;
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

function bufToHex(buf: ArrayBuffer): string {
    return hex.encode(new Uint8Array(buf));
}

function bufToBase64Url(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
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

function parseBlockchain(value: string): Blockchain {
    switch (value) {
        case "Near":
            return Blockchain.Near;
        case "Ethereum":
            return Blockchain.Ethereum;
        case "Solana":
            return Blockchain.Solana;
        default:
            throw new Error(`Unsupported blockchain value: ${value}`);
    }
}

$createPasskey.addEventListener("click", async () => {
    try {
        const created = await navigator.credentials.create({
            publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                rp: {name: "Wallet SDK Test"},
                user: {
                    id: crypto.getRandomValues(new Uint8Array(16)),
                    name: "wallet-sdk-user",
                    displayName: "Wallet SDK User",
                },
                pubKeyCredParams: [{alg: -7, type: "public-key"}],
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

        showOutput(
            $setupOutput,
            `Passkey created\nCredential ID: ${bufToHex(created.rawId)}\nPublic Key: ${publicKeyHex}`,
            "success",
        );
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
        const seqno = Number.parseInt($seqno.value, 10);
        const deadline = Number.parseInt($deadlineSec.value, 10);

        if (Number.isNaN(seqno) || seqno < 0) {
            throw new Error("Seqno must be a non-negative integer");
        }

        if (Number.isNaN(deadline) || deadline <= 0) {
            throw new Error("Deadline must be a positive integer");
        }

        wallet = new WalletContract(publicKey, "P256");

        const {message, challenge, accountId} = await wallet.preparePayload(
            payload,
            seqno,
            parseBlockchain($blockchain.value),
            deadline,
        );

        const walletState = wallet.createWalletState();

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
                `Wallet State: ${JSON.stringify(walletState, null, 2)}`,
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

        const proof = wallet.buildProof({
            authenticatorData: bufToBase64Url(response.authenticatorData),
            clientDataJSON: response.clientDataJSON,
            signature: bufToHex(response.signature),
            publicKey: $publicKey.value.trim(),
        });

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


        const baseUrl = $baseUrl.value.trim();
        if (!baseUrl) {
            throw new Error("Base URL is required");
        }

        showOutput($sendOutput, "Sending request...", "info");

        const {status, body} = await wallet.sendSign({
            message: currentMessage,
            proof: currentProof,
            baseUrl,
        });

        const resultType = status >= 200 && status < 300 ? "success" : "error";
        showOutput(
            $sendOutput,
            `Status: ${status}\n\nResponse:\n${body}`,
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
