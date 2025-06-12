import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private key = 'theme-dark-mode';

  isDark(): boolean {
    return localStorage.getItem(this.key) === 'true';
  }

  enableDark(): void {
    document.body.classList.add('dark-theme');
    localStorage.setItem(this.key, 'true');
  }

  disableDark(): void {
    document.body.classList.remove('dark-theme');
    localStorage.setItem(this.key, 'false');
  }

  toggle(): void {
    this.isDark() ? this.disableDark() : this.enableDark();
  }

  init(): void {
    this.isDark() ? this.enableDark() : this.disableDark();
  }
}
