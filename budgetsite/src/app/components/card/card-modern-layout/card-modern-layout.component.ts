import { Component, DoCheck, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-card-modern-layout',
  templateUrl: './card-modern-layout.component.html',
  styleUrls: ['./card-modern-layout.component.scss'],
})
export class CardModernLayoutComponent implements OnInit, DoCheck, OnDestroy {
  @Input() context!: any;

  pullDistance = 0;
  pullReady = false;
  isPullRefreshing = false;

  private pullStartY?: number;
  private pullTracking = false;
  private readonly pullRefreshThreshold = 58;
  private readonly maxPullDistance = 104;
  private readonly minPullRefreshDuration = 650;
  private pullRefreshStartedAt = 0;
  private pullRefreshFinishTimer?: number;
  private scheduledCardSelectionKey = '';
  private visibleCardSelectionKey = '';
  private routerEventsSubscription?: Subscription;

  constructor(private elementRef: ElementRef<HTMLElement>, private router: Router) {}

  ngOnInit(): void {
    this.routerEventsSubscription = this.router.events.subscribe((event) => {
      if (!(event instanceof NavigationEnd) || this.normalizeRoute(event.urlAfterRedirects) !== '/cards') return;

      this.visibleCardSelectionKey = '';
      this.scheduledCardSelectionKey = '';
      window.setTimeout(() => this.ensureSelectedCardVisible());
    });
  }

  ngOnDestroy(): void {
    this.routerEventsSubscription?.unsubscribe();
  }

  ngDoCheck(): void {
    if (this.isPullRefreshing && this.context?.hideProgress) this.schedulePullRefreshFinish();
    this.ensureSelectedCardVisible();
  }

  onReferenceChange(reference: string): void {
    this.context?.setReference(reference);
  }

  get pullRefreshLabel(): string {
    if (this.isPullRefreshing) return 'Atualizando cartões...';
    if (this.pullReady) return 'Solte para atualizar';
    return 'Arraste para atualizar';
  }

  onPullStart(event: TouchEvent): void {
    if (!this.isMobileViewport() || !this.context?.hideProgress || !this.isAtScrollTop(event)) return;
    if (event.touches.length !== 1) return;
    const touch = event.touches.item(0);
    if (!touch) return;
    this.pullStartY = touch.clientY;
    this.pullTracking = true;
    this.pullDistance = 0;
    this.pullReady = false;
  }

  onPullMove(event: TouchEvent): void {
    if (!this.pullTracking || this.pullStartY === undefined) return;
    const touch = event.touches.item(0);
    if (!touch || !this.isAtScrollTop(event)) {
      this.cancelPull();
      return;
    }
    const delta = touch.clientY - this.pullStartY;
    if (delta <= 0) {
      this.cancelPull();
      return;
    }
    event.preventDefault();
    this.pullDistance = Math.min(this.maxPullDistance, delta * 0.55);
    this.pullReady = this.pullDistance >= this.pullRefreshThreshold;
  }

  onPullEnd(): void {
    if (!this.pullTracking) return;
    const shouldRefresh = this.pullReady && this.context?.hideProgress;
    this.pullTracking = false;
    this.pullStartY = undefined;
    this.pullReady = false;
    if (!shouldRefresh) {
      this.pullDistance = 0;
      return;
    }
    this.isPullRefreshing = true;
    this.pullRefreshStartedAt = Date.now();
    this.pullDistance = this.pullRefreshThreshold;
    this.context.refresh();
  }

  onPullCancel(): void {
    this.cancelPull();
  }

  trackById(index: number, item: any): number {
    return item?.id ?? index;
  }

  private ensureSelectedCardVisible(): void {
    if (!this.context?.hideProgress || this.isPullRefreshing) {
      this.visibleCardSelectionKey = '';
      return;
    }

    const cardId = this.context?.cardId;
    const cardIds = (this.context?.cardsVisible ?? []).map((card: any) => card?.id).join(',');
    const selectionKey = `${cardId ?? ''}:${cardIds}`;

    if (cardId === undefined || cardId === null || !cardIds || selectionKey === this.scheduledCardSelectionKey) return;

    if (selectionKey === this.visibleCardSelectionKey) return;

    this.scheduledCardSelectionKey = selectionKey;

    window.setTimeout(() => {
      const selectedChip = this.elementRef.nativeElement.querySelector('.card-chip.active') as HTMLElement | null;

      this.scheduledCardSelectionKey = '';

      if (!selectedChip || this.context?.cardId !== cardId) return;

      const chipContainer = selectedChip.closest('.card-chips') as HTMLElement | null;

      if (!chipContainer) return;

      const centeredPosition = selectedChip.offsetLeft - (chipContainer.clientWidth - selectedChip.offsetWidth) / 2;
      const scrollBehavior: ScrollBehavior = this.visibleCardSelectionKey ? 'smooth' : 'auto';

      chipContainer.scrollTo({ left: Math.max(0, centeredPosition), behavior: scrollBehavior });
      this.visibleCardSelectionKey = selectionKey;
    });
  }

  private normalizeRoute(url: string): string {
    const path = url.split(/[?#]/, 1)[0];
    return path.startsWith('/') ? path : `/${path}`;
  }

  private isMobileViewport(): boolean {
    return window.matchMedia('(max-width: 600px)').matches;
  }

  private isAtScrollTop(event?: TouchEvent): boolean {
    let element: Element | null =
      event?.target instanceof Element
        ? event.target
        : this.elementRef.nativeElement;

    while (element && element !== document.body) {
      const style = window.getComputedStyle(element);
      const canScrollVertically =
        /(auto|scroll|overlay)/.test(style.overflowY) &&
        element.scrollHeight > element.clientHeight + 1;

      if (canScrollVertically && element.scrollTop > 0) return false;

      element = element.parentElement;
    }

    return window.scrollY <= 0 &&
      document.documentElement.scrollTop <= 0 &&
      document.body.scrollTop <= 0;
  }

  private cancelPull(): void {
    this.pullTracking = false;
    this.pullStartY = undefined;
    this.pullDistance = 0;
    this.pullReady = false;
  }

  private schedulePullRefreshFinish(): void {
    if (this.pullRefreshFinishTimer !== undefined) return;
    const remaining = Math.max(0, this.minPullRefreshDuration - (Date.now() - this.pullRefreshStartedAt));
    if (remaining === 0) {
      this.finishPullRefresh();
      return;
    }
    this.pullRefreshFinishTimer = window.setTimeout(() => {
      this.pullRefreshFinishTimer = undefined;
      if (this.context?.hideProgress) this.finishPullRefresh();
    }, remaining);
  }

  private finishPullRefresh(): void {
    if (this.pullRefreshFinishTimer !== undefined) window.clearTimeout(this.pullRefreshFinishTimer);
    this.pullRefreshFinishTimer = undefined;
    this.isPullRefreshing = false;
    this.pullDistance = 0;
  }
}
