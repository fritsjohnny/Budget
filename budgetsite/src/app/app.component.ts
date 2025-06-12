// app.component.ts
import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { ThemeService } from './services/theme/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  showBottomTabs = true;

  constructor(private router: Router, private themeService: ThemeService) {
    this.themeService.init();
    this.router.events.subscribe((evt) => {
      if (evt instanceof NavigationEnd) {
        this.showBottomTabs = !['/login', '/register'].includes(
          evt.urlAfterRedirects
        );
      }
    });
  }

  ngOnInit() {
    // só Android puro, sem Ionic Platform
    if (/Android/.test(navigator.userAgent) && window.visualViewport) {
      document.body.classList.add('android');
      // calcula a altura da nav-bar
      const navBarHeight = window.innerHeight - window.visualViewport.height;
      // injeta na raiz do CSS
      document.documentElement.style.setProperty(
        '--android-nav-bar-height',
        `${navBarHeight}px`
      );
    }
  }
}
