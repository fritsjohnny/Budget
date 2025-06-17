import { registerPlugin } from '@capacitor/core';

import { BudgetNotifierPlugin } from './definitions';

const BudgetNotifierPlugin = registerPlugin<BudgetNotifierPlugin>('BudgetNotifierPlugin', {
  web: () => import('./web').then((m) => new m.BudgetNotifierPluginWeb()),
});

export * from './definitions';
export { BudgetNotifierPlugin };
