import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { UserService } from 'src/app/services/user/user.service';
import { Messenger } from 'src/app/common/messenger';

@Component({
  selector: 'app-password-recovery',
  templateUrl: './password-recovery.component.html',
  styleUrls: ['./password-recovery.component.scss']
})
export class PasswordRecoveryComponent implements OnInit {
  readonly endpointsEnabled: boolean;
  readonly token: string;
  readonly emailFromLink: string;
  readonly isVerifyMode: boolean;
  readonly isResetMode: boolean;
  hidePassword = true;
  submitting = false;
  submitted = false;
  verificationComplete = false;
  verificationFailed = false;

  requestForm!: FormGroup;

  resetForm = new FormGroup({
    newPassword: new FormControl('', [Validators.required, Validators.minLength(12)]),
    confirmPassword: new FormControl('', Validators.required)
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private messenger: Messenger
  ) {
    this.endpointsEnabled = this.userService.passwordSecurityEndpointsEnabled;
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.emailFromLink = this.route.snapshot.queryParamMap.get('email') ?? '';
    this.isVerifyMode = this.route.snapshot.routeConfig?.path === 'verify-email';
    this.isResetMode = this.route.snapshot.routeConfig?.path === 'reset-password';
    this.requestForm = new FormGroup({
      email: new FormControl(this.emailFromLink, [Validators.required, Validators.email])
    });
  }

  ngOnInit(): void {
    document.documentElement.className = localStorage.getItem('theme') ?? 'light-theme';
    if (this.isVerifyMode && (!this.token || !this.emailFromLink)) {
      this.verificationFailed = true;
    } else if (this.isVerifyMode && this.endpointsEnabled) {
      this.submitting = true;
      this.userService.verifyEmail(this.emailFromLink, this.token).subscribe({
        next: () => {
          this.verificationComplete = true;
          this.submitting = false;
        },
        error: () => {
          this.verificationFailed = true;
          this.submitting = false;
        }
      });
    }
  }

  resendVerification(): void {
    this.requestForm.markAllAsTouched();
    if (this.requestForm.invalid || !this.endpointsEnabled || this.submitting) return;
    this.submitting = true;
    const email = (this.requestForm.controls['email'].value ?? '').trim().toLocaleLowerCase();
    this.userService.resendEmailVerification(email).subscribe({
      next: () => {
        this.submitted = true;
        this.submitting = false;
      },
      error: () => {
        this.submitted = true;
        this.submitting = false;
      }
    });
  }

  requestReset(): void {
    this.requestForm.markAllAsTouched();
    if (this.requestForm.invalid || !this.endpointsEnabled || this.submitting) return;

    this.submitting = true;
    const email = (this.requestForm.controls['email'].value ?? '').trim().toLocaleLowerCase();
    this.userService.requestPasswordReset(email).subscribe({
      next: () => {
        this.submitted = true;
        this.submitting = false;
      },
      error: () => {
        // The server should return the same generic success for known and unknown emails.
        this.submitted = true;
        this.submitting = false;
      }
    });
  }

  resetPassword(): void {
    this.resetForm.markAllAsTouched();
    if (this.resetForm.invalid || !this.endpointsEnabled || this.submitting) return;

    const { newPassword, confirmPassword } = this.resetForm.getRawValue();
    if (newPassword !== confirmPassword) {
      this.resetForm.controls['confirmPassword'].setErrors({ mismatch: true });
      return;
    }

    if (!this.emailFromLink) {
      this.messenger.message('O link de redefinição está incompleto. Solicite um novo link.');
      return;
    }

    this.submitting = true;
    this.userService.resetPassword(
      this.emailFromLink,
      this.token,
      newPassword ?? ''
    ).subscribe({
      next: () => {
        this.messenger.message('Senha redefinida. Entre com a nova senha.');
        void this.router.navigate(['/login']);
      },
      error: () => this.submitting = false
    });
  }
}
