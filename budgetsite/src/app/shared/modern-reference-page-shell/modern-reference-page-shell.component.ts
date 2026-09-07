import {
  AfterContentInit,
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ContentChild,
  DoCheck,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import * as _moment from 'moment';
import { default as _rollupMoment, Moment } from 'moment';
import { ModernReferenceSelectorComponent } from '../modern-reference-selector/modern-reference-selector.component';

const moment = _rollupMoment || _moment;

@Component({
  selector: 'app-modern-reference-page-shell',
  templateUrl: './modern-reference-page-shell.component.html',
  styleUrls: ['./modern-reference-page-shell.component.scss'],
})
export class ModernReferencePageShellComponent
  implements AfterContentInit, AfterViewInit, DoCheck, OnDestroy {
  @Input() reference?: string;
  @Input() refreshLabel = 'Atualizando...';
  @Input() refreshEnabled = true;
  @Input() refreshDisabled = false;
  @Input() refreshLoading = false;
  @Input() navigationDisabled = false;

  @Output() refreshRequested = new EventEmitter<void>();

  @ContentChild(ModernReferenceSelectorComponent)
  private referenceSelector?: ModernReferenceSelectorComponent;

  @ViewChild('referenceSelectorContainer')
  private referenceSelectorContainer?: ElementRef<HTMLElement>;

  pullDistance = 0;
  pullReady = false;
  isPullRefreshing = false;
  swipeDirection: 'previous' | 'next' | null = null;
  swipeDistance = 0;
  swipeOffsetX = 0;
  swipeReady = false;
  referenceCollapsed = false;

  private pullStartY?: number;
  private pullTracking = false;
  private touchStartX?: number;
  private touchStartY?: number;
  private touchAxis?: 'horizontal' | 'vertical';
  private touchTracking = false;
  private referenceObserver?: IntersectionObserver;
  private pullRefreshStartedAt = 0;
  private pullRefreshFinishTimer?: number;

  private readonly pullRefreshThreshold = 58;
  private readonly maxPullDistance = 104;
  private readonly minPullRefreshDuration = 650;
  private readonly swipeActivationDistance = 12;
  private readonly swipeReferenceThreshold = 92;
  private readonly maxSwipeDistance = 136;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private cd: ChangeDetectorRef
  ) {}

  ngAfterContentInit(): void {
    moment.locale('pt-BR');
  }

  ngAfterViewInit(): void {
    this.setupReferenceObserver();
  }

  ngDoCheck(): void {
    if (!this.isPullRefreshing || this.refreshLoading) return;

    const elapsed = Date.now() - this.pullRefreshStartedAt;

    if (elapsed >= this.minPullRefreshDuration) {
      this.finishPullRefresh();
      return;
    }

    this.schedulePullRefreshFinish(this.minPullRefreshDuration - elapsed);
  }

  ngOnDestroy(): void {
    this.referenceObserver?.disconnect();

    if (this.pullRefreshFinishTimer !== undefined) {
      window.clearTimeout(this.pullRefreshFinishTimer);
    }
  }

  get referenceTitle(): string {
    return this.referenceMoment.format('MMMM YYYY').toLocaleUpperCase('pt-BR');
  }

  get previousReferenceLabel(): string {
    return this.referenceMoment
      .clone()
      .subtract(1, 'month')
      .format('MMMM YYYY')
      .toLocaleUpperCase('pt-BR');
  }

  get nextReferenceLabel(): string {
    return this.referenceMoment
      .clone()
      .add(1, 'month')
      .format('MMMM YYYY')
      .toLocaleUpperCase('pt-BR');
  }

  get pullRefreshLabel(): string {
    if (this.isPullRefreshing) return this.refreshLabel;
    if (this.pullReady) return 'Solte para atualizar';

    return 'Arraste para atualizar';
  }

  onTouchStart(event: TouchEvent): void {
    this.startSwipeGesture(event);
    this.startPullGesture(event);
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.touchTracking || this.touchStartX === undefined || this.touchStartY === undefined) {
      this.movePullGesture(event);
      return;
    }

    const touch = event.touches.item(0);

    if (!touch) return;

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!this.touchAxis && Math.max(absX, absY) < this.swipeActivationDistance) return;

    if (!this.touchAxis) {
      this.touchAxis = absX > absY * 1.15 ? 'horizontal' : 'vertical';
    }

    if (this.touchAxis === 'vertical') {
      this.resetSwipeFeedback();
      this.movePullGesture(event);
      return;
    }

    this.cancelPull();

    if (event.cancelable) {
      event.preventDefault();
    }

    this.swipeDirection = deltaX > 0 ? 'previous' : 'next';
    this.swipeDistance = Math.min(this.maxSwipeDistance, absX);
    this.swipeOffsetX = deltaX > 0 ? this.swipeDistance : -this.swipeDistance;
    this.swipeReady = this.swipeDistance >= this.swipeReferenceThreshold;
  }

  onTouchEnd(): void {
    const horizontalGesture = this.touchAxis === 'horizontal';
    const direction = this.swipeDirection;
    const shouldChangeReference =
      horizontalGesture &&
      this.swipeReady &&
      !!direction &&
      !this.navigationDisabled &&
      !this.refreshLoading;

    this.resetSwipeGesture();

    if (horizontalGesture) {
      this.cancelPull();

      if (shouldChangeReference) {
        if (direction === 'previous') {
          this.referenceSelector?.setPreviousReference();
        } else {
          this.referenceSelector?.setNextReference();
        }
      }

      return;
    }

    this.endPullGesture();
  }

  onTouchCancel(): void {
    this.resetSwipeGesture();
    this.cancelPull();
  }

  private get referenceMoment(): Moment {
    if (this.reference && /^\d{6}$/.test(this.reference)) {
      const parsed = moment(this.reference, 'YYYYMM', true);
      if (parsed.isValid()) return parsed;
    }

    return moment();
  }

  private startSwipeGesture(event: TouchEvent): void {
    if (
      !this.isMobileViewport() ||
      this.navigationDisabled ||
      this.refreshLoading ||
      event.touches.length !== 1 ||
      this.isInteractiveTouchTarget(event.target)
    ) {
      this.resetSwipeGesture();
      return;
    }

    const touch = event.touches.item(0);

    if (!touch) return;

    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchAxis = undefined;
    this.touchTracking = true;
    this.resetSwipeFeedback();
  }

  private startPullGesture(event: TouchEvent): void {
    if (
      !this.refreshEnabled ||
      this.refreshDisabled ||
      this.refreshLoading ||
      !this.isMobileViewport() ||
      !this.isAtScrollTop(event) ||
      event.touches.length !== 1
    ) {
      return;
    }

    const touch = event.touches.item(0);

    if (!touch) return;

    this.pullStartY = touch.clientY;
    this.pullTracking = true;
    this.pullDistance = 0;
    this.pullReady = false;
  }

  private movePullGesture(event: TouchEvent): void {
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

    if (event.cancelable) {
      event.preventDefault();
    }

    this.pullDistance = Math.min(this.maxPullDistance, delta * 0.55);
    this.pullReady = this.pullDistance >= this.pullRefreshThreshold;
  }

  private endPullGesture(): void {
    if (!this.pullTracking) return;

    const shouldRefresh =
      this.pullReady &&
      !this.refreshDisabled &&
      !this.refreshLoading;

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
    this.refreshRequested.emit();
    this.schedulePullRefreshFinish(this.minPullRefreshDuration);
  }

  private resetSwipeGesture(): void {
    this.touchStartX = undefined;
    this.touchStartY = undefined;
    this.touchAxis = undefined;
    this.touchTracking = false;
    this.resetSwipeFeedback();
  }

  private resetSwipeFeedback(): void {
    this.swipeDirection = null;
    this.swipeDistance = 0;
    this.swipeOffsetX = 0;
    this.swipeReady = false;
  }

  private isInteractiveTouchTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;

    return !!target.closest(
      'button, a, input, textarea, select, [contenteditable="true"], .mat-checkbox, [data-reference-swipe-ignore]'
    );
  }

  private setupReferenceObserver(): void {
    const target = this.referenceSelectorContainer?.nativeElement;

    if (!target || typeof IntersectionObserver === 'undefined') return;

    const root = this.findScrollableAncestor(target);
    const toolbar = document.querySelector('.app-toolbar') as HTMLElement | null;
    const toolbarHeight = toolbar?.getBoundingClientRect().height ?? (this.isMobileViewport() ? 58 : 64);
    const stickyBoundary = Math.round(toolbarHeight + 6);

    this.referenceObserver?.disconnect();
    this.referenceObserver = new IntersectionObserver(
      entries => {
        const entry = entries[0];

        if (!entry) return;

        const rootTop = root?.getBoundingClientRect().top ?? 0;
        const topBoundary = rootTop + stickyBoundary;
        const shouldCollapse =
          !entry.isIntersecting && entry.boundingClientRect.bottom <= topBoundary + 1;

        if (this.referenceCollapsed === shouldCollapse) return;

        this.referenceCollapsed = shouldCollapse;
        this.cd.detectChanges();
      },
      {
        root,
        threshold: 0,
        rootMargin: `-${stickyBoundary}px 0px 0px 0px`,
      }
    );

    this.referenceObserver.observe(target);
  }

  private findScrollableAncestor(element: HTMLElement): HTMLElement | null {
    let parent = element.parentElement;

    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      const canScrollVertically =
        /(auto|scroll|overlay)/.test(style.overflowY) &&
        parent.scrollHeight > parent.clientHeight + 1;

      if (canScrollVertically) return parent;

      parent = parent.parentElement;
    }

    return null;
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

  private isMobileViewport(): boolean {
    return window.matchMedia('(max-width: 600px)').matches;
  }

  private cancelPull(): void {
    this.pullTracking = false;
    this.pullStartY = undefined;
    this.pullDistance = 0;
    this.pullReady = false;
  }

  private schedulePullRefreshFinish(delay: number): void {
    if (this.pullRefreshFinishTimer !== undefined) return;

    this.pullRefreshFinishTimer = window.setTimeout(() => {
      this.pullRefreshFinishTimer = undefined;

      if (!this.refreshLoading) {
        this.finishPullRefresh();
      }
    }, Math.max(0, delay));
  }

  private finishPullRefresh(): void {
    if (this.pullRefreshFinishTimer !== undefined) {
      window.clearTimeout(this.pullRefreshFinishTimer);
      this.pullRefreshFinishTimer = undefined;
    }

    this.isPullRefreshing = false;
    this.pullDistance = 0;
  }
}
