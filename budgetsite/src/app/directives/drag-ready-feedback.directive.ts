import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  Renderer2
} from '@angular/core';

@Directive({
  selector: '[appDragReadyFeedback]'
})
export class DragReadyFeedbackDirective implements OnDestroy {
  @Input() dragReadyDelay = 300;

  private timeoutRef: any = null;
  private pointerId: number | null = null;

  constructor(private el: ElementRef, private renderer: Renderer2) { }

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    if (this.timeoutRef) return;

    this.pointerId = event.pointerId;

    this.timeoutRef = setTimeout(() => {
      if (this.pointerId !== null) {
        this.renderer.addClass(this.el.nativeElement, 'ready-to-drag');
      }
    }, this.dragReadyDelay);
  }

  @HostListener('pointerup')
  @HostListener('pointercancel')
  @HostListener('pointerleave')
  onPointerUp(): void {
    this.clear();
  }

  ngOnDestroy(): void {
    this.clear();
  }

  private clear(): void {
    clearTimeout(this.timeoutRef);
    this.timeoutRef = null;
    this.pointerId = null;
    this.renderer.removeClass(this.el.nativeElement, 'ready-to-drag');
  }
}
