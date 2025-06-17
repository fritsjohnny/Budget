import { WebPlugin } from '@capacitor/core';

import type { BudgetNotifierPlugin } from './definitions';

export class BudgetNotifierPluginWeb extends WebPlugin implements BudgetNotifierPlugin {
  async schedule(): Promise<{ success: boolean; }> {
    console.log('SCHEDULE');
    return { success: true };
  }
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }
}
