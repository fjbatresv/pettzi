import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class EncryptionService {
  private readonly keyStorageKey = 'pettzi.cryptoKey';
  private readonly ivLength = 12;

  async encryptString(value: string): Promise<string> {
    const key = await this.getKey();
    const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
    const encoded = new TextEncoder().encode(value);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return this.packPayload(iv, new Uint8Array(cipher));
  }

  async decryptString(payload: string): Promise<string | null> {
    const parsed = this.unpackPayload(payload);
    if (!parsed) {
      return null;
    }
    const key = await this.getKey();
    try {
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: parsed.iv },
        key,
        parsed.data
      );
      return new TextDecoder().decode(plain);
    } catch {
      return null;
    }
  }

  clearKey() {
    sessionStorage.removeItem(this.keyStorageKey);
  }

  getStoredKey() {
    return sessionStorage.getItem(this.keyStorageKey);
  }

  setStoredKey(value: string) {
    sessionStorage.setItem(this.keyStorageKey, value);
  }

  private async getKey(): Promise<CryptoKey> {
    const stored = sessionStorage.getItem(this.keyStorageKey);
    if (stored) {
      const raw = this.base64ToArrayBuffer(stored);
      return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    }
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
    const raw = await crypto.subtle.exportKey('raw', key);
    sessionStorage.setItem(this.keyStorageKey, this.arrayBufferToBase64(raw));
    return key;
  }

  private packPayload(iv: Uint8Array, data: Uint8Array) {
    const combined = new Uint8Array(iv.length + data.length);
    combined.set(iv);
    combined.set(data, iv.length);
    return this.arrayBufferToBase64(combined.buffer);
  }

  private unpackPayload(payload: string) {
    try {
      const bytes = new Uint8Array(this.base64ToArrayBuffer(payload));
      if (bytes.length <= this.ivLength) {
        return null;
      }
      const iv = bytes.slice(0, this.ivLength);
      const data = bytes.slice(this.ivLength);
      return { iv, data };
    } catch {
      return null;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
