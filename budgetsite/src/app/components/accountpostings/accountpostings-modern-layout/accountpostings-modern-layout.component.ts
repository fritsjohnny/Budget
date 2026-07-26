import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-accountpostings-modern-layout',
  templateUrl: './accountpostings-modern-layout.component.html',
  styleUrls: ['./accountpostings-modern-layout.component.scss'],
})
export class AccountPostingsModernLayoutComponent {
  @Input() context!: any;

  trackById(index: number, item: any): number {
    return item?.id ?? index;
  }
}
