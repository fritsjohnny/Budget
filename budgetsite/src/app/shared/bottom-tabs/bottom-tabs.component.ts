import { Component, OnInit } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Router } from '@angular/router';
import { NavService } from 'src/app/components/template/nav/nav.service';

@Component({
  selector: 'app-bottom-tabs',
  templateUrl: './bottom-tabs.component.html',
  styleUrls: ['./bottom-tabs.component.scss'],
})
export class BottomTabsComponent implements OnInit {
  tabs = [
    { path: '/summary', label: 'Saldos', icon: 'account_balance_wallet' },
    { path: '/budget', label: 'Orçamento', icon: 'view_quilt' },
    { path: '/accounts', label: 'Contas', icon: 'account_balance' },
    { path: '/cards', label: 'Cartões', icon: 'credit_card' },
    { path: '/reports', label: 'Relatórios', icon: 'pie_chart' },
  ];

  isMobile = false;
  activeTab = '/budget'; // padrão

  constructor(
    private breakpointObserver: BreakpointObserver,
    private router: Router,
    private navService: NavService
  ) {}

  ngOnInit(): void {
    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .subscribe((result) => {
        this.isMobile = result.matches;
      });

    const currentUrl = this.router.url;

    // Se estiver na raiz, redireciona para /budget
    if (currentUrl === '/' || currentUrl === '') {
      this.router.navigateByUrl('/budget');
      this.activeTab = '/budget';
      return;
    }

    // Caso contrário, marca a aba correspondente como ativa
    const found = this.tabs.find((t) => t.path === currentUrl);
    this.activeTab = found ? found.path : '/budget';
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
