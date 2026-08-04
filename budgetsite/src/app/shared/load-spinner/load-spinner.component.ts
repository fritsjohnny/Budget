import { Component, HostListener, Input } from '@angular/core';

@Component({
  selector: 'app-load-spinner',
  templateUrl: './load-spinner.component.html',
  styleUrls: ['./load-spinner.component.scss'],
})
export class LoadSpinnerComponent {
  @Input() loading = false;

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    if (this.loading) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (this.loading) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (this.loading && [' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
}
