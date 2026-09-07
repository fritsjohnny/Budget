import { Component, DoCheck, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-account-modern-layout',
  templateUrl: './account-modern-layout.component.html',
  styleUrls: ['./account-modern-layout.component.scss'],
})
export class AccountModernLayoutComponent implements OnInit, DoCheck, OnDestroy {
  @Input() context!: any;

  private scheduledAccountSelectionKey = '';
  private visibleAccountSelectionKey = '';
  private routerEventsSubscription?: Subscription;

  constructor(private elementRef: ElementRef<HTMLElement>, private router: Router) {}

  ngOnInit(): void {
    this.routerEventsSubscription = this.router.events.subscribe((event) => {
      if (!(event instanceof NavigationEnd) || this.normalizeRoute(event.urlAfterRedirects) !== '/accounts') return;

      this.visibleAccountSelectionKey = '';
      this.scheduledAccountSelectionKey = '';
      window.setTimeout(() => this.ensureSelectedAccountVisible());
    });
  }

  ngDoCheck(): void {
    this.ensureSelectedAccountVisible();
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

  private ensureSelectedAccountVisible(): void {
    if (!this.context?.hideProgress) {
      this.visibleAccountSelectionKey = '';
      return;
    }

    const accountId = this.context?.accountId;
    const accountIds = (this.context?.accountsVisible ?? []).map((account: any) => account?.id).join(',');
    const selectionKey = `${accountId ?? ''}:${accountIds}`;

    if (!accountId || !accountIds || selectionKey === this.scheduledAccountSelectionKey) return;
    if (selectionKey === this.visibleAccountSelectionKey) return;

    this.scheduledAccountSelectionKey = selectionKey;

    window.setTimeout(() => {
      const selectedChip = this.elementRef.nativeElement.querySelector('.account-chip-active') as HTMLElement | null;

      this.scheduledAccountSelectionKey = '';

      if (!selectedChip || this.context?.accountId !== accountId) return;

      const chipContainer = selectedChip.closest('.account-chips') as HTMLElement | null;

      if (!chipContainer) return;

      const centeredPosition = selectedChip.offsetLeft - (chipContainer.clientWidth - selectedChip.offsetWidth) / 2;
      const scrollBehavior: ScrollBehavior = this.visibleAccountSelectionKey ? 'smooth' : 'auto';

      chipContainer.scrollTo({ left: Math.max(0, centeredPosition), behavior: scrollBehavior });
      this.visibleAccountSelectionKey = selectionKey;
    });
  }

  private normalizeRoute(url: string): string {
    const path = url.split(/[?#]/, 1)[0];
    return path.startsWith('/') ? path : `/${path}`;
  }
}
