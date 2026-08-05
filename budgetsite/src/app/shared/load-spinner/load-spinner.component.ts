import { DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, Inject, Input, OnDestroy, Renderer2 } from '@angular/core';

@Component({
  selector: 'app-load-spinner',
  templateUrl: './load-spinner.component.html',
  styleUrls: ['./load-spinner.component.scss'],
})
export class LoadSpinnerComponent implements AfterViewInit, OnDestroy {
  @Input() loading = false;
  @Input() message = 'Carregando...';

  private originalParent: Node | null = null;
  private originalNextSibling: Node | null = null;

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2,
    @Inject(DOCUMENT) private readonly document: Document,
  ) { }

  ngAfterViewInit(): void {
    const host = this.elementRef.nativeElement;

    if (host.parentElement !== this.document.body) {
      this.originalParent = host.parentNode;
      this.originalNextSibling = host.nextSibling;
      this.renderer.appendChild(this.document.body, host);
    }
  }

  ngOnDestroy(): void {
    const host = this.elementRef.nativeElement;

    if (this.originalParent && host.parentNode === this.document.body) {
      this.renderer.insertBefore(this.originalParent, host, this.originalNextSibling);
    }
  }

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
