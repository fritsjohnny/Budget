import { WebPlugin } from '@capacitor/core';

import type { BudgetNotifierPluginPlugin } from './definitions';

export class BudgetNotifierPluginWeb extends WebPlugin implements BudgetNotifierPluginPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }
}
