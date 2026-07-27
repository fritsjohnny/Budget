import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly key = 'theme';
  private readonly darkTheme = 'dark-theme';
  private readonly lightTheme = 'light-theme';

  isDark(): boolean {
    return localStorage.getItem(this.key) === this.darkTheme;
  }

  applyTheme(theme: string): void {
    const normalizedTheme = theme === this.darkTheme ? this.darkTheme : this.lightTheme;

    this.applyThemeClass(document.documentElement, normalizedTheme);
    document.body.classList.remove(this.lightTheme, this.darkTheme);
    localStorage.setItem(this.key, normalizedTheme);
  }

  enableDark(): void {
    this.applyTheme(this.darkTheme);
  }

  disableDark(): void {
    this.applyTheme(this.lightTheme);
  }

  toggle(): void {
    this.isDark() ? this.disableDark() : this.enableDark();
  }

  init(): void {
    this.applyTheme(localStorage.getItem(this.key) ?? this.lightTheme);
  }

  private applyThemeClass(element: HTMLElement, theme: string): void {
    element.classList.remove(this.lightTheme, this.darkTheme);
    element.classList.add(theme);
  }
}
