import { Component, OnInit } from '@angular/core';
import { NavService } from 'src/app/components/template/nav/nav.service';

@Component({
  selector: 'app-annual-savings-view',
  templateUrl: './annual-savings-view.component.html',
  styleUrls: ['./annual-savings-view.component.scss']
})
export class AnnualSavingsViewComponent implements OnInit {

  constructor(private navService: NavService) {
    navService.navData = {
      title: 'Economia anual',
      icon: 'savings',
      routeUrl: '/annual-savings'
    };
  }

  ngOnInit(): void { }
}
