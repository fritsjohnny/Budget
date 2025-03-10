import { Component, OnInit } from '@angular/core';
import { NavService } from 'src/app/components/template/nav/nav.service';

@Component({
  selector: 'app-report-view',
  templateUrl: './report-view.component.html',
  styleUrls: ['./report-view.component.scss'],
})
export class ReportViewComponent implements OnInit {
  constructor(private navService: NavService) {
    navService.navData = {
      title: 'Relatórios',
      icon: 'pie_chart',
      routeUrl: '/reports',
    };
  }
  ngOnInit(): void {}
}
