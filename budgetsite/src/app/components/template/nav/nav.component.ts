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

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss']
})
export class NavComponent implements OnInit, AfterViewInit, OnDestroy {

  theme = localStorage.getItem('theme') ?? 'light-theme';
  mobile: boolean = false;
  themeToggle = false;

  user!: Users;

  @ViewChild('drawer') drawer!: MatDrawer;
  @ViewChild(MatSidenavContent) sidenavContent!: MatSidenavContent;

  private readonly scrollPositions = new Map<string, number>();
  private routerEventsSubscription?: Subscription;
  private currentRouteKey = '';
  private firstAnimationFrame?: number;
  private secondAnimationFrame?: number;

  constructor(
    private breakpointObserver: BreakpointObserver,
    private navService: NavService,
    private userService: UserService,
    private router: Router
  ) { }

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  ngOnInit(): void {

    this.themeToggle = this.theme == 'dark-theme';

    document.documentElement.className = this.theme;

    this.user = JSON.parse(localStorage.getItem('user')!);
  }

  ngAfterViewInit(): void {
    this.currentRouteKey = this.normalizeRouteKey(this.router.url);

    this.routerEventsSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.saveCurrentScrollPosition();
      }

      if (event instanceof NavigationEnd) {
        this.currentRouteKey = this.normalizeRouteKey(event.urlAfterRedirects);
        this.scheduleScrollRestoration(this.currentRouteKey);
      }
    });

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

    this.theme = this.themeToggle ? 'dark-theme' : 'light-theme'

    document.documentElement.className = this.theme;

    localStorage.setItem('theme', this.theme);
  }

  viewUser() {

    this.closeSideNav();

    this.router.navigate(['/users'], { state: { user: this.user } });
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
