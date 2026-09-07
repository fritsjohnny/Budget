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

  ngDoCheck(): void {
    this.ensureSelectedCardVisible();
  }

  ngOnDestroy(): void {
    this.routerEventsSubscription?.unsubscribe();
  }

  onReferenceChange(reference: string): void {
    this.context?.setReference(reference);
  }

  trackById(index: number, item: any): number {
    return item?.id ?? index;
  }

  private ensureSelectedCardVisible(): void {
    if (!this.context?.hideProgress) {
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
}
