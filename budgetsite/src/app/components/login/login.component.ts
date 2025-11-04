import { UsersAuthenticateRequest } from './../../models/usersauthenticaterequest';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { UserService } from './../../services/user/user.service';
import { Messenger } from 'src/app/common/messenger';
import { BiometricAuthService } from 'src/app/core/services/biometric-auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

  _login!: string;
  _password!: string;
  hide = true;
  hideProgress: boolean = true;

  theme = localStorage.getItem('theme') ?? 'light-theme';

  loginFormGroup = new FormGroup(
    {
      loginFormControl: new FormControl('', Validators.required),
      passwordFormControl: new FormControl('', Validators.required)
    });

  canBiometric = false;

  constructor(
    private usuarioService: UserService,
    private messenger: Messenger,
    private bio: BiometricAuthService,
    private router: Router,
  ) { }

  async ngOnInit() {
    document.documentElement.className = this.theme;

    // habilita o botão apenas quando houver sessão salva + biometria disponível
    const hasToken = !!(await this.bio.getSessionToken());
    const enabled = await this.bio.isBiometricEnabled().catch(() => false);
    const avail = await this.bio.isAvailable().catch(() => false);
    this.canBiometric = hasToken && enabled && avail;
  }

  login() {

    if (this.loginFormGroup.invalid)
      return;

    this.hideProgress = false;

    let userAuthenticateRequest: UsersAuthenticateRequest =
    {
      login: this._login,
      password: this._password
    };

    this.usuarioService.login(userAuthenticateRequest).subscribe(
      {
        next: () => {

          this.hideProgress = true;
        },
        error: (error) => {

          this.hideProgress = true;

          this.messenger.message(error.error.message);
        }
      }
    );
  }

  // fluxo real: entrar com biometria
  async loginWithBiometrics() {
    // se ainda não tem token salvo, avisa e retorna
    const token = await this.bio.getSessionToken();
    if (!token) {
      this.messenger.message('Para usar a biometria, faça login uma vez com usuário e senha.', 5000);
      return;
    }

    // pede a biometria
    const ok = await this.bio.authenticate();
    if (!ok) return; // usuário cancelou

    // evita o segundo prompt disparado pelo guard ao entrar na rota protegida
    this.bio.suppressGuardPromptOnce();

    // sucesso → entra
    this.router.navigateByUrl('', { replaceUrl: true });
  }
}