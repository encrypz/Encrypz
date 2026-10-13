// using PBKDF2 instead of argon2

// Convert string to Uint8Array
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const deriveKey = async (password: string, saltString: string): Promise<CryptoKey> => {
    const salt = textEncoder.encode(saltString);
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        textEncoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
    
    return await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
};

export const encryptData = async (data: Uint8Array, key: CryptoKey) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv as any
        },
        key,
        data as any
    );

    const ciphertext = new Uint8Array(encryptedBuffer);
    
    // In Web Crypto API, the auth tag is appended to the ciphertext
    const payload = ciphertext.slice(0, -16);
    const authTag = ciphertext.slice(-16);

    return {
        payload,
        iv,
        authTag
    };
};

export const decryptData = async (payload: Uint8Array, iv: Uint8Array, authTag: Uint8Array, key: CryptoKey) => {
    // Recombine payload and auth tag for Web Crypto API
    const encryptedBuffer = new Uint8Array(payload.length + authTag.length);
    encryptedBuffer.set(payload, 0);
    encryptedBuffer.set(authTag, payload.length);

    const decryptedBuffer = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv as any
        },
        key,
        encryptedBuffer as any
    );

    return new Uint8Array(decryptedBuffer);
};

// Helpers for base64
export const arrayBufferToBase64 = (buffer: Uint8Array): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

export const base64ToArrayBuffer = (base64: string): Uint8Array => {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
};

export const stringToUint8Array = (str: string): Uint8Array => {
    return textEncoder.encode(str);
};

export const uint8ArrayToString = (arr: Uint8Array): string => {
    return textDecoder.decode(arr);
};

export interface VaultConfig {
    version: 2;
    iterations: 600000;
    salt: string;
    iv: string;
    wrappedKey: string;
}

let activeVaultKey: CryptoKey | null = null;
export const getVaultKey = () => activeVaultKey;
export const lockVault = () => { activeVaultKey = null; };
export const activateVaultKey = (key: CryptoKey) => { activeVaultKey = key; };

const wrappingKey = async (password: string, salt: Uint8Array) => {
    const material = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', iterations: 600000, salt: salt as BufferSource },
        material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};

// Neither the password nor the unwrapped key is sent to the API or written to browser storage.
export const createVaultConfig = async (password: string, accountId: string, existingKey?: Uint8Array) => {
    const raw = existingKey ?? crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrapper = await wrappingKey(password, salt);
    const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: textEncoder.encode(`Encrypz:v2:${accountId}`) }, wrapper, raw as BufferSource);
    const key = await crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
    const config: VaultConfig = { version: 2, iterations: 600000, salt: arrayBufferToBase64(salt), iv: arrayBufferToBase64(iv), wrappedKey: arrayBufferToBase64(new Uint8Array(wrapped)) };
    raw.fill(0);
    return { config, key };
};

export const unlockVaultConfig = async (password: string, accountId: string, config: VaultConfig) => {
    const salt = base64ToArrayBuffer(config.salt);
    const iv = base64ToArrayBuffer(config.iv);
    const wrapped = base64ToArrayBuffer(config.wrappedKey);
    if (config.version !== 2 || config.iterations !== 600000 || salt.length !== 32 || iv.length !== 12 || wrapped.length !== 48)
        throw new Error('Unsupported or damaged vault configuration. Restore your backup.');
    const wrapper = await wrappingKey(password, salt);
    let raw: ArrayBuffer;
    try {
        raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource,
            additionalData: textEncoder.encode(`Encrypz:v2:${accountId}`) }, wrapper, wrapped as BufferSource);
    } catch { throw new Error('Incorrect master password, or the vault configuration is damaged.'); }
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    new Uint8Array(raw).fill(0);
    return key;
};

export const encryptName = async (name: string, key: CryptoKey) => {
    const { payload, iv, authTag } = await encryptData(textEncoder.encode(name), key);
    return JSON.stringify({ v: 2, data: arrayBufferToBase64(payload), iv: arrayBufferToBase64(iv), tag: arrayBufferToBase64(authTag) });
};
export const decryptName = async (value: string, key: CryptoKey) => {
    const envelope = JSON.parse(value);
    if (envelope.v !== 2) throw new Error('Unsupported encrypted filename.');
    return textDecoder.decode(await decryptData(base64ToArrayBuffer(envelope.data), base64ToArrayBuffer(envelope.iv), base64ToArrayBuffer(envelope.tag), key));
};
