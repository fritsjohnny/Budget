import { Component, OnInit } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

@Component({
  selector: 'app-bottom-tabs',
  templateUrl: './bottom-tabs.component.html',
  styleUrls: ['./bottom-tabs.component.scss'],
})
export class BottomTabsComponent implements OnInit {
  activeTab = 'summary'; // adiciona isso dentro da classe

  tabs = [
    {
      key: 'summary',
      path: '/summary',
      label: 'Saldos',
      icon: 'account_balance_wallet',
    },
    { key: 'budget', path: '/budget', label: 'Orçamento', icon: 'view_quilt' },
    {
      key: 'accounts',
      path: '/accounts',
      label: 'Contas',
      icon: 'account_balance',
    },
    { key: 'cards', path: '/cards', label: 'Cartões', icon: 'credit_card' },
    {
      key: 'reports',
      path: '/reports',
      label: 'Relatórios',
      icon: 'pie_chart',
    },
  ];

  isMobile = false;

  constructor(private breakpointObserver: BreakpointObserver) {}

  ngOnInit(): void {
    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .subscribe((result) => {
        this.isMobile = result.matches;
      });
  }
}
