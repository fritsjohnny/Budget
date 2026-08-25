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

interface ScrollPosition {
  top: number;
  left: number;
}

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

  private readonly scrollPositions = new Map<string, Map<string, ScrollPosition>>();
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
  private readonly scrollRestorationTimers: number[] = [];

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
        this.cancelScheduledScrollRestoration();
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

    const root = this.sidenavContent.getElementRef().nativeElement as HTMLElement;
    const routePositions = new Map<string, ScrollPosition>();

    for (const element of this.getScrollableElements(root)) {
      routePositions.set(this.getScrollElementKey(element, root), {
        top: element.scrollTop,
        left: element.scrollLeft
      });
    }

    this.scrollPositions.set(this.currentRouteKey, routePositions);
  }

  private scheduleScrollRestoration(routeKey: string): void {
    this.cancelScheduledScrollRestoration();

    this.firstAnimationFrame = requestAnimationFrame(() => {
      this.secondAnimationFrame = requestAnimationFrame(() => {
        this.firstAnimationFrame = undefined;
        this.secondAnimationFrame = undefined;
        this.restoreScrollPositions(routeKey, 0);
      });
    });
  }

  private restoreScrollPositions(routeKey: string, attempt: number): void {
    const root = this.sidenavContent.getElementRef().nativeElement as HTMLElement;
    const savedPositions = this.scrollPositions.get(routeKey);

    if (!savedPositions) {
      root.scrollTop = 0;
      root.scrollLeft = 0;
      return;
    }

    const elementsByKey = new Map(
      this.getScrollableElements(root)
        .map(element => [this.getScrollElementKey(element, root), element] as const)
    );

    let needsRetry = false;

    for (const [key, position] of savedPositions) {
      const element = elementsByKey.get(key);

      if (!element) {
        needsRetry = needsRetry || position.top > 0 || position.left > 0;
        continue;
      }

      const maximumTop = Math.max(0, element.scrollHeight - element.clientHeight);
      const maximumLeft = Math.max(0, element.scrollWidth - element.clientWidth);

      if (position.top > maximumTop || position.left > maximumLeft) {
        needsRetry = true;
      }

      element.scrollTop = Math.min(position.top, maximumTop);
      element.scrollLeft = Math.min(position.left, maximumLeft);
    }

    if (needsRetry && attempt < 20) {
      const timer = window.setTimeout(() => {
        const index = this.scrollRestorationTimers.indexOf(timer);

        if (index >= 0) {
          this.scrollRestorationTimers.splice(index, 1);
        }

        this.restoreScrollPositions(routeKey, attempt + 1);
      }, 100);

      this.scrollRestorationTimers.push(timer);
    }
  }

  private getScrollableElements(root: HTMLElement): HTMLElement[] {
    const elements = [
      root,
      ...Array.from(root.querySelectorAll<HTMLElement>('*'))
    ];

    return elements.filter((element, index) => {
      if (index > 0 && element.getClientRects().length === 0) {
        return false;
      }

      if (element === root) {
        return true;
      }

      const style = window.getComputedStyle(element);
      const verticalOverflow = ['auto', 'scroll', 'overlay'].includes(style.overflowY);
      const horizontalOverflow = ['auto', 'scroll', 'overlay'].includes(style.overflowX);

      return (
        (verticalOverflow && element.scrollHeight > element.clientHeight) ||
        (horizontalOverflow && element.scrollWidth > element.clientWidth)
      );
    });
  }

  private getScrollElementKey(element: HTMLElement, root: HTMLElement): string {
    if (element === root) {
      return '__page__';
    }

    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== root) {
      const parent: HTMLElement | null = current.parentElement;
      const signature = this.getScrollElementSignature(current);
      const siblings = parent
        ? Array.from(parent.children).filter(
          child => child instanceof HTMLElement &&
            this.getScrollElementSignature(child) === signature
        )
        : [];
      const siblingIndex = siblings.indexOf(current);

      path.unshift(`${signature}[${Math.max(0, siblingIndex)}]`);
      current = parent;
    }

    return path.join('/');
  }

  private getScrollElementSignature(element: HTMLElement): string {
    const classes = Array.from(element.classList)
      .filter(className => className !== 'ng-star-inserted')
      .sort()
      .join('.');
    const id = element.id ? `#${element.id}` : '';

    return `${element.tagName.toLowerCase()}${id}${classes ? `.${classes}` : ''}`;
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

    for (const timer of this.scrollRestorationTimers) {
      window.clearTimeout(timer);
    }

    this.scrollRestorationTimers.length = 0;
  }

  private normalizeRouteKey(url: string): string {
    const path = url.split(/[?#]/, 1)[0];

    if (!path || path === '/') {
      return '/summary';
    }

    return path.startsWith('/') ? path : `/${path}`;
  }
}
