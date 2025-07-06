import { registerPlugin } from '@capacitor/core';
import type { NotificationReaderPlugin } from './definitions';

const NotificationReader = registerPlugin<NotificationReaderPlugin>('NotificationReaderPlugin');

export { NotificationReader };
export * from './definitions';
