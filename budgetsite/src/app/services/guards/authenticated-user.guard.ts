import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { UserService } from '../user/user.service';
import { BiometricAuthService } from 'src/app/core/services/biometric-auth.service';

@Injectable({ providedIn: 'root' })
export class AuthenticatedUserGuard implements CanActivate {
  constructor(
    private userService: UserService,
    private router: Router,
    private bio: BiometricAuthService
  ) { }

  async canActivate(): Promise<boolean | UrlTree> {
    const token = await this.userService.getUserTokenAsync();
    if (!token) return this.router.parseUrl('login');

    if (this.bio.consumeGuardPromptSuppression()) {
      return true; // não dispara biometria do guard agora
    }

    const avail = await this.bio.isAvailable();
    if (avail) {
      this.bio.beginBiometric();
      const ok = await this.bio.authenticate();
      this.bio.endBiometric();
      if (!ok) { this.bio.markBiometricCanceled(); return this.router.parseUrl('login'); }
    }

    // autenticado com sucesso → segue pra rota
    return true;
  }
}
