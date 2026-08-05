import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-notification-bubble',
  templateUrl: './notification-bubble.component.html',
  styleUrls: ['./notification-bubble.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBubbleComponent {
  @Input() message = '';
  @Input() closeNotification: () => void = () => undefined;

  close(): void {
    this.closeNotification();
  }
}
