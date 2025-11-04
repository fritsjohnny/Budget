import { Injectable } from '@angular/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Preferences } from '@capacitor/preferences';

@Injectable({ providedIn: 'root' })
export class BiometricAuthService {
    // --- constantes/keys ---
    private readonly INACTIVITY_MS = 5 * 60 * 1000; // 5 minutos
    private readonly PAUSED_AT_KEY = 'budget_paused_at_ts';
    private readonly LAST_BIO_TS_KEY = 'budget_last_bio_ts';

    // --- estados em memória (não persistem entre aberturas do app) ---
    private bypassBiometricOnce = false;
    private suppressNextGuardPrompt = false;
    // --- registrar início/fim do prompt (se já não tiver) ---
    private biometricInProgress = false;

    beginBiometric() { this.biometricInProgress = true; }
    endBiometric() { this.biometricInProgress = false; }
    isBiometricInProgress() { return this.biometricInProgress; }

    // marca que o próximo acesso à tela de login deve ser liberado (sem redirecionar pra home)
    markBiometricCanceled() { this.bypassBiometricOnce = true; }
    // o guard de “não autenticado” consome essa flag e permite ficar no login
    consumeBypass(): boolean {
        const b = this.bypassBiometricOnce;
        this.bypassBiometricOnce = false;
        return b;
    }

    suppressGuardPromptOnce() { this.suppressNextGuardPrompt = true; }

    consumeGuardPromptSuppression(): boolean {
        const v = this.suppressNextGuardPrompt;
        this.suppressNextGuardPrompt = false;
        return v;
    }

    async isAvailable(): Promise<boolean> {
        try {
            const res: any = await (BiometricAuth as any).checkBiometry?.();
            if (res?.available ?? res?.isAvailable) {
                return (res.biometryType ?? 'unknown') !== 'none';
            }
            if (typeof res?.result === 'string') {
                return res.result === 'success' && (res.biometryType ?? 'unknown') !== 'none';
            }
        } catch { }
        return false;
    }

    // --- marcar pausa/resumo do app ---
    async markPausedNow(): Promise<void> {
        // pode usar Preferences, pois é só timestamp (não sensível)
        await Preferences.set({ key: this.PAUSED_AT_KEY, value: String(Date.now()) });
    }
    async clearPaused(): Promise<void> {
        await Preferences.remove({ key: this.PAUSED_AT_KEY });
    }

    // --- guardar o momento do último sucesso biométrico ---
    private async recordBiometricSuccess(): Promise<void> {
        await Preferences.set({ key: this.LAST_BIO_TS_KEY, value: String(Date.now()) });
    }

    // --- checar se precisa reautenticar por inatividade ---
    async needsReauth(): Promise<boolean> {
        const pausedAt = Number((await Preferences.get({ key: this.PAUSED_AT_KEY })).value ?? 0);
        if (pausedAt > 0) {
            const inactive = Date.now() - pausedAt;
            if (inactive >= this.INACTIVITY_MS) return true;
        }
        // fallback adicional: tempo desde a última biometria (caso queira exigir periodicamente)
        const lastBio = Number((await Preferences.get({ key: this.LAST_BIO_TS_KEY })).value ?? 0);
        if (lastBio > 0 && (Date.now() - lastBio) >= this.INACTIVITY_MS) return true;

        return false;
    }

    async authenticate(reason = 'Confirme sua identidade'): Promise<boolean> {
        try {
            this.beginBiometric();

            const res: any = await BiometricAuth.authenticate({
                reason,
                allowDeviceCredential: true,
                androidTitle: 'Autenticar com biometria',
            });

            const ok = (typeof res?.authenticated === 'boolean') ? res.authenticated
                : (typeof res?.result === 'string') ? (res.result === 'success')
                    : true;
            if (ok) await this.recordBiometricSuccess();
            return ok;
        } finally {
            this.endBiometric();
        }
    }

    async saveSessionToken(token: string): Promise<void> {
        await SecureStorage.set('session_token', token);
    }

    async getSessionToken(): Promise<string | null> {
        const value = (await SecureStorage.get('session_token')) as string | null;
        return typeof value === 'string' ? value : null;
    }

    async clearSession(): Promise<void> {
        await SecureStorage.remove('session_token');
    }

    // chave para habilitar biometria
    private BIOMETRIC_FLAG = 'biometric_enabled';

    async setBiometricEnabled(enabled: boolean): Promise<void> {
        await SecureStorage.set(this.BIOMETRIC_FLAG, enabled ? 'true' : 'false');
    }

    async isBiometricEnabled(): Promise<boolean> {
        const v = (await SecureStorage.get(this.BIOMETRIC_FLAG)) as string | null;
        return v === 'true';
    }
}
