import { registerPlugin } from '@capacitor/core';

import type { BudgetNotifierPluginPlugin } from './definitions';

const BudgetNotifierPlugin = registerPlugin<BudgetNotifierPluginPlugin>('BudgetNotifierPlugin', {
  web: () => import('./web').then((m) => new m.BudgetNotifierPluginWeb()),
});

export * from './definitions';
export { BudgetNotifierPlugin };
