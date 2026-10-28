import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Messenger } from 'src/app/common/messenger';
import { UsersRegisterRequest } from 'src/app/models/usersregisterrequest';
import { UserService } from 'src/app/services/user/user.service';

@Component({
  selector: 'app-userregister',
  templateUrl: './userregister.component.html',
  styleUrls: ['./userregister.component.scss']
})
export class UserRegisterComponent implements OnInit {
  readonly emailRegistrationAvailable: boolean;

  _name = '';
  _login = '';
  _email = '';
  _password = '';
  _confirmPassword = '';

  hide = true;
  hideProgress: boolean = true;
  registrationComplete = false;
  resendingVerification = false;
  loadingMessage: string = 'Criando usuário...';

  theme = localStorage.getItem('theme') ?? 'light-theme';

  userRegisterFormGroup = new FormGroup(
    {
      nameFormControl: new FormControl('', Validators.required),
      loginFormControl: new FormControl('', Validators.required),
      emailFormControl: new FormControl('', [Validators.required, Validators.email]),
      passwordFormControl: new FormControl('', [Validators.required, Validators.minLength(12)]),
      confirmPasswordFormControl: new FormControl('', Validators.required)
    });

  constructor(private userService: UserService, private messenger: Messenger) {
    this.emailRegistrationAvailable = this.userService.passwordSecurityEndpointsEnabled;
  }

  ngOnInit(): void {

    document.documentElement.className = this.theme;
  }

  register() {

    this.userRegisterFormGroup.markAllAsTouched();
    if (this.userRegisterFormGroup.invalid)
      return;

    if (this._password !== this._confirmPassword) {
      this.userRegisterFormGroup.controls['confirmPasswordFormControl'].setErrors({ mismatch: true });
      return;
    }

    this.hideProgress = false;

    if (!this.userService.passwordSecurityEndpointsEnabled) {
      this.hideProgress = true;
      this.messenger.message('O cadastro com e-mail depende da atualização da API. Tente novamente depois que o serviço for atualizado.');
      return;
    }

    let userRegisterRequest: UsersRegisterRequest =
    {
      name: this._name,
      login: this._login,
      email: this._email.trim().toLocaleLowerCase(),
      password: this._password
    };

    this.userService.create(userRegisterRequest).subscribe({
      next: () => {
        this.hideProgress = true;
        this.registrationComplete = true;
        this.messenger.message('Cadastro criado. Confirme seu e-mail antes de entrar.');
      },
      error: err => {
        this.hideProgress = true;
        this.messenger.message(err?.error?.message ?? err?.error?.detail ?? 'Não foi possível criar a conta. Verifique os dados e tente novamente.');
      }
    });
  }

  resendVerification(): void {
    if (!this._email || this.resendingVerification) return;
    this.resendingVerification = true;
    this.userService.resendEmailVerification(this._email.trim().toLocaleLowerCase()).subscribe({
      next: () => {
        this.messenger.message('Se o cadastro precisar de confirmação, enviaremos um novo link.');
        this.resendingVerification = false;
      },
      error: () => this.resendingVerification = false
    });
  }
}
