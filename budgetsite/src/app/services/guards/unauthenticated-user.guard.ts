import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { UserService } from '../user/user.service';
import { BiometricAuthService } from 'src/app/core/services/biometric-auth.service';

@Injectable({
  providedIn: 'root'
})
export class UnautheticatedUserGuard implements CanActivate {

  constructor(
    private userService: UserService,
    private router: Router,
    private bio: BiometricAuthService
  ) { }

  async canActivate(): Promise<boolean | UrlTree> {
    // se o usuário acabou de cancelar a biometria, permite ficar no login
    if (this.bio.consumeBypass()) return true;

    // fluxo anterior: se “logado”, manda pra home
    if (this.userService.logged)
      return this.router.parseUrl('');

    const token = await this.userService.getUserTokenAsync();

    if (token)
      return this.router.parseUrl('');

    return true; // pode ver a tela de login
  }

}
