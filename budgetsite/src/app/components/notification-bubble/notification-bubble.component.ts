import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-notification-bubble',
  templateUrl: './notification-bubble.component.html',
  styleUrls: ['./notification-bubble.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBubbleComponent {
  @Input() message = '';
  @Input() clickNotification?: () => void;
  @Input() closeNotification: () => void = () => undefined;

  click(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.clickNotification?.();
  }

  close(event: Event): void {
    event.stopPropagation();
    this.closeNotification();
  }
}
