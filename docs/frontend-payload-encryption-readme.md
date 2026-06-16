# Frontend Payload Encryption Guide

This backend supports encrypted request/response payloads when:

- `API_PAYLOAD_ENCRYPTION_ENABLED=true`
- `API_PAYLOAD_ENCRYPTION_KEY=<shared-secret>`

When enabled:

- Request bodies must be sent as `{ "payload": "<encrypted-string>" }`
- Responses are returned as `{ "payload": "<encrypted-string>" }`
- Query params and path params stay plain text

## Encryption Format

The encrypted payload format is:

`base64url(iv).base64url(authTag).base64url(ciphertext)`

- Algorithm: `AES-256-GCM`
- IV length: `12` bytes
- Key: `SHA-256` hash of the shared secret string (`API_PAYLOAD_ENCRYPTION_KEY`)

## Frontend Utility (TypeScript)

Create `src/utils/payloadCrypto.ts` in frontend:

```ts
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", TEXT_ENCODER.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptPayload(data: unknown, secret: string): Promise<string> {
  const key = await deriveAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = TEXT_ENCODER.encode(JSON.stringify(data));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    plaintext,
  );

  // WebCrypto AES-GCM output is ciphertext + 16-byte auth tag at end.
  const encryptedBytes = new Uint8Array(encryptedBuffer);
  const tag = encryptedBytes.slice(encryptedBytes.length - 16);
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 16);

  return `${toBase64Url(iv)}.${toBase64Url(tag)}.${toBase64Url(ciphertext)}`;
}

export async function decryptPayload<T = unknown>(payload: string, secret: string): Promise<T> {
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format");
  }

  const [ivB64, tagB64, ciphertextB64] = parts;
  const iv = fromBase64Url(ivB64);
  const tag = fromBase64Url(tagB64);
  const ciphertext = fromBase64Url(ciphertextB64);

  // WebCrypto expects ciphertext + tag combined.
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  const key = await deriveAesKey(secret);
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    combined,
  );

  const text = TEXT_DECODER.decode(decryptedBuffer);
  return JSON.parse(text) as T;
}
```

## Fetch Example

```ts
import { encryptPayload, decryptPayload } from "./utils/payloadCrypto";

const SECRET = import.meta.env.VITE_API_PAYLOAD_ENCRYPTION_KEY as string;

export async function postEncrypted<TReq, TRes>(url: string, body: TReq): Promise<TRes> {
  const encrypted = await encryptPayload(body, SECRET);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: encrypted }),
    credentials: "include",
  });

  const json = await response.json();
  if (!response.ok) {
    // Error payload is also encrypted when feature is enabled.
    if (json?.payload) {
      const decryptedError = await decryptPayload<any>(json.payload, SECRET);
      throw new Error(
        Array.isArray(decryptedError?.message)
          ? decryptedError.message.join(", ")
          : decryptedError?.message || "Request failed",
      );
    }
    throw new Error("Request failed");
  }

  if (!json?.payload) {
    throw new Error("Missing encrypted response payload");
  }

  return decryptPayload<TRes>(json.payload, SECRET);
}
```

## Axios Interceptor Example

```ts
import axios from "axios";
import { encryptPayload, decryptPayload } from "./utils/payloadCrypto";

const SECRET = import.meta.env.VITE_API_PAYLOAD_ENCRYPTION_KEY as string;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toLowerCase();
  const shouldEncryptBody = ["post", "put", "patch", "delete"].includes(method);
  if (shouldEncryptBody && config.data && typeof config.data === "object") {
    const encrypted = await encryptPayload(config.data, SECRET);
    config.data = { payload: encrypted };
  }
  return config;
});

api.interceptors.response.use(
  async (response) => {
    if (response?.data?.payload) {
      response.data = await decryptPayload(response.data.payload, SECRET);
    }
    return response;
  },
  async (error) => {
    const encryptedError = error?.response?.data?.payload;
    if (encryptedError) {
      const decrypted = await decryptPayload<any>(encryptedError, SECRET);
      error.response.data = decrypted;
    }
    return Promise.reject(error);
  },
);
```

## Important Notes

- Keep the shared secret out of source code. Use frontend env (e.g. `VITE_API_PAYLOAD_ENCRYPTION_KEY`).
- If encryption is ON in backend, plain JSON body requests will fail.
- `/api/docs` and `/api-json` are bypassed by backend encryption logic.
- For file uploads (`multipart/form-data`), follow backend upload rules (encryption is not applied to file binary itself).

