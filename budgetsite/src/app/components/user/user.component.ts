import { Component, HostListener, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Messenger } from 'src/app/common/messenger';
import { Users } from 'src/app/models/users';
import { UserService } from 'src/app/services/user/user.service';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserComponent implements OnInit {
  readonly passwordChangeAvailable: boolean;
  user!: Users;
  hideCurrentPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;
  savingProfile = false;
  savingPassword = false;
  resendingEmail = false;
  passwordFormVisible = false;
  private profileRefreshInProgress = false;
  private lastAutomaticProfileRefreshAt = 0;

  profileForm = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    email: new FormControl('', Validators.email)
  });

  passwordForm = new FormGroup({
    currentPassword: new FormControl('', Validators.required),
    newPassword: new FormControl('', [Validators.required, Validators.minLength(12)]),
    confirmPassword: new FormControl('', Validators.required)
  });

  constructor(
    private router: Router,
    private userService: UserService,
    private messenger: Messenger
  ) {
    this.passwordChangeAvailable = this.userService.passwordSecurityEndpointsEnabled;
    const navigationUser = this.router.getCurrentNavigation()?.extras.state?.['user'] as Users | undefined;
    const storedUser = localStorage.getItem('user');
    this.user = navigationUser ?? (storedUser ? JSON.parse(storedUser) as Users : { name: '', login: '' });
  }

  ngOnInit(): void {
    this.loadProfile(true);
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    this.refreshProfileAfterResume();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (!document.hidden) this.refreshProfileAfterResume();
  }

  saveProfile(): void {
    if (this.profileForm.invalid || this.savingProfile) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.savingProfile = true;
    this.userService.updateProfile(
      this.profileForm.controls['name'].value ?? '',
      this.profileForm.controls['email'].value ?? ''
    ).subscribe({
      next: updated => {
        this.applyProfile(updated, true);
        this.messenger.message(updated.pendingEmail
          ? 'Nome salvo. Confirme o novo e-mail pelo link que enviamos.'
          : 'Dados atualizados com sucesso.');
        this.savingProfile = false;
      },
      error: () => {
        this.savingProfile = false;
        // The API may save the profile but fail while sending the confirmation email.
        // Refresh so the pending email and resend action reflect the server state.
        this.loadProfile(true);
      }
    });
  }

  resendEmailVerification(): void {
    const email = this.user.pendingEmail || this.user.email;
    if (!email || this.resendingEmail) return;
    this.resendingEmail = true;
    this.userService.resendEmailVerification(email).subscribe({
      next: () => {
        this.messenger.message('Se a conta precisar de confirmação, enviaremos um novo link.');
        this.resendingEmail = false;
      },
      error: () => this.resendingEmail = false
    });
  }

  togglePasswordForm(): void {
    this.passwordFormVisible = !this.passwordFormVisible;
    if (!this.passwordFormVisible) this.passwordForm.reset();
  }

  changePassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.savingPassword) return;

    const { newPassword, confirmPassword } = this.passwordForm.getRawValue();
    if (newPassword !== confirmPassword) {
      this.passwordForm.controls['confirmPassword'].setErrors({ mismatch: true });
      return;
    }

    const currentPassword = this.passwordForm.controls['currentPassword'].value ?? '';
    this.savingPassword = true;
    this.userService.changePassword(currentPassword, newPassword ?? '').subscribe({
      next: () => {
        this.passwordForm.reset();
        this.messenger.message('Senha alterada. Por segurança, entre novamente com sua nova senha.');
        void this.userService.logout();
      },
      error: () => this.savingPassword = false
    });
  }

  private refreshProfileAfterResume(): void {
    const now = Date.now();
    if (document.hidden || this.savingProfile || this.profileRefreshInProgress || now - this.lastAutomaticProfileRefreshAt < 1500) return;
    this.lastAutomaticProfileRefreshAt = now;
    this.loadProfile();
  }

  private loadProfile(forceFormSync = false): void {
    if (this.profileRefreshInProgress) return;
    this.profileRefreshInProgress = true;
    this.userService.getProfile().subscribe({
      next: profile => {
        this.applyProfile(profile, forceFormSync);
        this.profileRefreshInProgress = false;
      },
      error: () => this.profileRefreshInProgress = false
    });
  }

  private applyProfile(profile: Users, forceFormSync = false): void {
    this.user = { ...this.user, ...profile, password: undefined };
    const storedUser = JSON.parse(localStorage.getItem('user') ?? '{}');
    localStorage.setItem('user', JSON.stringify({ ...storedUser, ...profile, password: undefined }));
    if (forceFormSync || !this.profileForm.dirty) {
      this.profileForm.patchValue({
        name: profile.name ?? '',
        email: profile.pendingEmail ?? profile.email ?? ''
      });
      this.profileForm.markAsPristine();
    }
  }
}
