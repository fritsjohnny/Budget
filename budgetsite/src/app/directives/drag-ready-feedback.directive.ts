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
    this.clearTimeoutOnly();

    this.pointerId = event.pointerId;

    this.timeoutRef = setTimeout(() => {
      if (this.pointerId !== null) {
        this.renderer.addClass(this.el.nativeElement, 'ready-to-drag');
      }
    }, this.dragReadyDelay);
  }

  @HostListener('dragstart')
  onDragStart(): void {
    this.removeReadyState();
  }

  @HostListener('pointerup')
  @HostListener('pointercancel')
  onPointerUp(): void {
    this.clear();
  }

  @HostListener('document:pointerup')
  onDocumentPointerUp(): void {
    this.clear();
  }

  ngOnDestroy(): void {
    this.clear();
  }

  private clear(): void {
    this.clearTimeoutOnly();
    this.removeReadyState();
    this.pointerId = null;
  }

  private clearTimeoutOnly(): void {
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
      this.timeoutRef = null;
    }
  }

  private removeReadyState(): void {
    this.renderer.removeClass(this.el.nativeElement, 'ready-to-drag');
  }
}