import { Component, DoCheck, ElementRef, Input } from '@angular/core';

@Component({
  selector: 'app-card-modern-layout',
  templateUrl: './card-modern-layout.component.html',
  styleUrls: ['./card-modern-layout.component.scss'],
})
export class CardModernLayoutComponent implements DoCheck {
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

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  ngDoCheck(): void {
    if (this.isPullRefreshing && this.context?.hideProgress) this.schedulePullRefreshFinish();
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
    if (!this.isMobileViewport() || !this.context?.hideProgress || !this.isAtScrollTop()) return;
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
    if (!touch || !this.isAtScrollTop()) {
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

  private isMobileViewport(): boolean {
    return window.matchMedia('(max-width: 600px)').matches;
  }

  private isAtScrollTop(): boolean {
    const host = this.elementRef.nativeElement;
    const scrollContainer = host.closest('.mat-sidenav-content, .mat-drawer-content') as HTMLElement | null;
    return scrollContainer ? scrollContainer.scrollTop <= 0 :
      window.scrollY <= 0 && document.documentElement.scrollTop <= 0 && document.body.scrollTop <= 0;
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
