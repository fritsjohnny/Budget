import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable, Subscription } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { NavService } from './nav.service';
import { MatDrawer, MatSidenavContent } from '@angular/material/sidenav';
import { UserService } from 'src/app/services/user/user.service';
import { Users } from 'src/app/models/users';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { ThemeService } from 'src/app/services/theme/theme.service';

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss']
})
export class NavComponent implements OnInit, AfterViewInit, OnDestroy {

  theme = localStorage.getItem('theme') ?? 'light-theme';
  mobile: boolean = false;
  themeToggle = false;
  budgetLayoutToggle = localStorage.getItem('budgetLayout') === 'modern';

  user!: Users;

  @ViewChild('drawer') drawer!: MatDrawer;
  @ViewChild(MatSidenavContent) sidenavContent!: MatSidenavContent;

  private readonly scrollPositions = new Map<string, number>();
  private readonly lastRouteStorageKey = 'lastVisitedRoute';
  private readonly restorableRoutes = new Set([
    '/summary',
    '/budget',
    '/accounts',
    '/cards',
    '/reports',
    '/annual-savings'
  ]);
  private routerEventsSubscription?: Subscription;
  private currentRouteKey = '';
  private firstAnimationFrame?: number;
  private secondAnimationFrame?: number;

  constructor(
    private breakpointObserver: BreakpointObserver,
    private navService: NavService,
    private userService: UserService,
    private router: Router,
    private themeService: ThemeService
  ) { }

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  ngOnInit(): void {

    this.themeToggle = this.theme == 'dark-theme';

    this.themeService.applyTheme(this.theme);

    this.user = JSON.parse(localStorage.getItem('user')!);
  }

  ngAfterViewInit(): void {
    const initialUrl = this.router.url;
    this.currentRouteKey = this.normalizeRouteKey(initialUrl);

    this.routerEventsSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.saveCurrentScrollPosition();
      }

      if (event instanceof NavigationEnd) {
        this.currentRouteKey = this.normalizeRouteKey(event.urlAfterRedirects);
        this.saveLastVisitedRoute(this.currentRouteKey);
        this.scheduleScrollRestoration(this.currentRouteKey);
      }
    });

    if (this.isRootRoute(initialUrl) && this.restoreLastVisitedRoute()) {
      return;
    }

    this.scheduleScrollRestoration(this.currentRouteKey);
  }

  ngOnDestroy(): void {
    this.routerEventsSubscription?.unsubscribe();
    this.cancelScheduledScrollRestoration();
  }

  get icon(): string {

    return this.navService.navData.icon;
  }

  get title(): string {

    return this.navService.navData.title;
  }

  get routeUrl(): string {

    return this.navService.navData.routeUrl;
  }

  closeSideNav() {

    if (this.drawer.mode == 'over') {

      this.drawer.close();
    }
  }

  logout() {

    this.userService.logout();
  }

  changeTheme() {

    this.theme = this.themeToggle ? 'dark-theme' : 'light-theme';

    this.themeService.applyTheme(this.theme);
  }

  changeBudgetLayout(): void {
    const layout = this.budgetLayoutToggle ? 'modern' : 'classic';

    localStorage.setItem('budgetLayout', layout);
    window.dispatchEvent(
      new CustomEvent('budget-layout-change', { detail: layout })
    );
  }

  viewUser() {

    this.closeSideNav();

    this.router.navigate(['/users'], { state: { user: this.user } });
  }

  private restoreLastVisitedRoute(): boolean {
    const savedRoute = localStorage.getItem(this.lastRouteStorageKey);

    if (!savedRoute) {
      return false;
    }

    if (!this.restorableRoutes.has(savedRoute)) {
      localStorage.removeItem(this.lastRouteStorageKey);
      return false;
    }

    if (savedRoute === '/summary') {
      return false;
    }

    void this.router.navigateByUrl(savedRoute, { replaceUrl: true });
    return true;
  }

  private saveLastVisitedRoute(routeKey: string): void {
    if (this.restorableRoutes.has(routeKey)) {
      localStorage.setItem(this.lastRouteStorageKey, routeKey);
    }
  }

  private isRootRoute(url: string): boolean {
    return url.split(/[?#]/, 1)[0] === '/';
  }

  private saveCurrentScrollPosition(): void {
    if (!this.currentRouteKey) {
      return;
    }

    const scrollElement = this.sidenavContent.getElementRef().nativeElement;
    this.scrollPositions.set(this.currentRouteKey, scrollElement.scrollTop);
  }

  private scheduleScrollRestoration(routeKey: string): void {
    this.cancelScheduledScrollRestoration();

    this.firstAnimationFrame = requestAnimationFrame(() => {
      this.secondAnimationFrame = requestAnimationFrame(() => {
        const scrollElement = this.sidenavContent.getElementRef().nativeElement;
        const savedPosition = this.scrollPositions.get(routeKey) ?? 0;
        const maximumPosition = Math.max(
          0,
          scrollElement.scrollHeight - scrollElement.clientHeight
        );

        scrollElement.scrollTop = Math.min(savedPosition, maximumPosition);
        this.firstAnimationFrame = undefined;
        this.secondAnimationFrame = undefined;
      });
    });
  }

  private cancelScheduledScrollRestoration(): void {
    if (this.firstAnimationFrame !== undefined) {
      cancelAnimationFrame(this.firstAnimationFrame);
      this.firstAnimationFrame = undefined;
    }

    if (this.secondAnimationFrame !== undefined) {
      cancelAnimationFrame(this.secondAnimationFrame);
      this.secondAnimationFrame = undefined;
    }
  }

  private normalizeRouteKey(url: string): string {
    const path = url.split(/[?#]/, 1)[0];

    if (!path || path === '/') {
      return '/summary';
    }

    return path.startsWith('/') ? path : `/${path}`;
  }
}
