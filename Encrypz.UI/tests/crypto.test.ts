import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVaultConfig, unlockVaultConfig, encryptData, decryptData, encryptName, decryptName, activateVaultKey, getVaultKey, lockVault } from '../src/utils/crypto.ts';

test('a fresh device unlocks the same file and filename with its Google account and password', async () => {
    const { config, key } = await createVaultConfig('correct master password', 'google-account');
    const data = new TextEncoder().encode('private file contents');
    const encrypted = await encryptData(data, key);
    const name = await encryptName('private.txt', key);
    assert.ok(!JSON.stringify(config).includes('correct master password'));
    assert.ok(!name.includes('private.txt'));
    const freshKey = await unlockVaultConfig('correct master password', 'google-account', JSON.parse(JSON.stringify(config)));
    assert.deepEqual(await decryptData(encrypted.payload, encrypted.iv, encrypted.authTag, freshKey), data);
    assert.equal(await decryptName(name, freshKey), 'private.txt');
    assert.equal(freshKey.extractable, false);
    await assert.rejects(unlockVaultConfig('wrong password', 'google-account', config));
    await assert.rejects(unlockVaultConfig('correct master password', 'different-account', config));
    const damaged = { ...config, wrappedKey: 'A' + config.wrappedKey.slice(1) };
    if (damaged.wrappedKey === config.wrappedKey) damaged.wrappedKey = 'B' + config.wrappedKey.slice(1);
    await assert.rejects(unlockVaultConfig('correct master password', 'google-account', damaged));
    await assert.rejects(unlockVaultConfig('correct master password', 'google-account', { ...config, iterations: 1 } as any));
});

test('locking discards the key and tampered file data fails authentication', async () => {
    const { key } = await createVaultConfig('another password', 'account');
    activateVaultKey(key); assert.equal(getVaultKey(), key);
    lockVault(); assert.equal(getVaultKey(), null);
    const data = await encryptData(new Uint8Array([1, 2, 3]), key);
    data.payload[0] ^= 1;
    await assert.rejects(decryptData(data.payload, data.iv, data.authTag, key));
});
