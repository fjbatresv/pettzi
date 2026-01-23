import { Injectable, inject } from '@angular/core';
import { EncryptionService } from './encryption.service';
import { AuthTokens } from './auth.service';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly encryption = inject(EncryptionService);
  private readonly accessKey = 'pettzi.accessToken';
  private readonly idKey = 'pettzi.idToken';
  private readonly expiresKey = 'pettzi.accessTokenExpiresAt';
  private readonly refreshKey = 'pettzi.hasRefreshToken';
  private readonly channel =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('pettzi.session')
      : null;
  private readonly syncKey = 'pettzi.cryptoKey';

  constructor() {
    this.setupChannel();
  }

  async storeTokens(tokens: AuthTokens & { expiresIn?: number }) {
    await this.storeToken(this.idKey, tokens.idToken);
    await this.storeToken(this.accessKey, tokens.accessToken);
    sessionStorage.setItem(this.refreshKey, 'true');
    if (tokens.expiresIn) {
      sessionStorage.setItem(this.expiresKey, String(Date.now() + tokens.expiresIn * 1000));
    }
    this.broadcastState();
  }

  async getAccessToken() {
    return this.getToken(this.accessKey);
  }

  async getIdToken() {
    return this.getToken(this.idKey);
  }

  hasStoredSession() {
    return !!(
      sessionStorage.getItem(this.accessKey)
    );
  }

  hasRefreshToken() {
    return sessionStorage.getItem(this.refreshKey) === 'true';
  }

  clear() {
    this.clearLocal();
    this.channel?.postMessage({ type: 'clear' });
  }

  private async storeToken(key: string, value: string) {
    const encrypted = await this.encryption.encryptString(value);
    sessionStorage.setItem(key, encrypted);
  }

  private async getToken(key: string) {
    const stored = sessionStorage.getItem(key);
    if (!stored) {
      return null;
    }
    return this.encryption.decryptString(stored);
  }

  private setupChannel() {
    if (!this.channel) {
      return;
    }
    this.channel.addEventListener('message', (event) => {
      const { type, payload } = event.data ?? {};
      if (type === 'sync-request') {
        this.broadcastState();
        return;
      }
      if (type === 'sync-state') {
        if (this.hasStoredSession()) {
          return;
        }
        const key = payload?.key as string | undefined;
        if (key) {
          this.encryption.setStoredKey(key);
          sessionStorage.setItem(this.syncKey, key);
        }
        if (payload?.accessToken) {
          sessionStorage.setItem(this.accessKey, payload.accessToken);
        }
        if (payload?.idToken) {
          sessionStorage.setItem(this.idKey, payload.idToken);
        }
        if (payload?.expiresAt) {
          sessionStorage.setItem(this.expiresKey, payload.expiresAt);
        }
        if (payload?.hasRefresh === true) {
          sessionStorage.setItem(this.refreshKey, 'true');
        }
        return;
      }
      if (type === 'clear') {
        this.clearLocal();
      }
    });

    this.channel.postMessage({ type: 'sync-request' });
  }

  private broadcastState() {
    if (!this.channel) {
      return;
    }
    const accessToken = sessionStorage.getItem(this.accessKey);
    const idToken = sessionStorage.getItem(this.idKey);
    if (!accessToken && !idToken) {
      return;
    }
    this.channel.postMessage({
      type: 'sync-state',
      payload: {
        key: this.encryption.getStoredKey(),
        accessToken,
        idToken,
        expiresAt: sessionStorage.getItem(this.expiresKey),
        hasRefresh: sessionStorage.getItem(this.refreshKey) === 'true',
      },
    });
  }

  private clearLocal() {
    sessionStorage.removeItem(this.accessKey);
    sessionStorage.removeItem(this.idKey);
    sessionStorage.removeItem(this.expiresKey);
    sessionStorage.removeItem(this.refreshKey);
    sessionStorage.removeItem('pettzi.petInviteToken');
    sessionStorage.removeItem('pettzi.petInviteAutoAccept');
    this.encryption.clearKey();
  }
}
