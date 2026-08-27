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
