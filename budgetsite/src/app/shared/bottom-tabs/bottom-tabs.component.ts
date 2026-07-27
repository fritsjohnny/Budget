import { Component, OnDestroy, OnInit } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Router } from '@angular/router';
import { NavService } from 'src/app/components/template/nav/nav.service';

@Component({
  selector: 'app-bottom-tabs',
  templateUrl: './bottom-tabs.component.html',
  styleUrls: ['./bottom-tabs.component.scss'],
})
export class BottomTabsComponent implements OnInit, OnDestroy {
  tabs = [
    { path: '/summary', label: 'Saldos', icon: 'account_balance_wallet' },
    { path: '/budget', label: 'Orçamento', icon: 'view_quilt' },
    { path: '/accounts', label: 'Contas', icon: 'account_balance' },
    { path: '/cards', label: 'Cartões', icon: 'credit_card' },
    { path: '/reports', label: 'Relatórios', icon: 'pie_chart' },
    { path: '/annual-savings', label: 'Economia', icon: 'savings' },
  ];

  isMobile = false;
  activeTab = '/summary';
  useModernLayout = localStorage.getItem('budgetLayout') === 'modern';

  private readonly handleBudgetLayoutChange = (event: Event): void => {
    const layout = (event as CustomEvent<string>).detail;
    this.useModernLayout = layout === 'modern';
  };

  constructor(
    private breakpointObserver: BreakpointObserver,
    private router: Router,
    private navService: NavService
  ) {}

  ngOnInit(): void {
    window.addEventListener(
      'budget-layout-change',
      this.handleBudgetLayoutChange as EventListener
    );

    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .subscribe((result) => {
        this.isMobile = result.matches;
      });

    const currentUrl = this.router.url.split(/[?#]/, 1)[0];
    const found = this.tabs.find((tab) => tab.path === currentUrl);

    this.activeTab = found ? found.path : '/summary';
  }

  ngOnDestroy(): void {
    window.removeEventListener(
      'budget-layout-change',
      this.handleBudgetLayoutChange as EventListener
    );
  }

  setActiveTab(tab: any): void {
    this.activeTab = tab.path;
    this.router.navigateByUrl(tab.path);

    this.navService.setTitle({
      title: tab.label,
      icon: tab.icon,
      routeUrl: tab.path,
    });
  }
}
