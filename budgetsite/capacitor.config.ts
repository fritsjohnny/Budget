import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.budget.app',
  appName: 'BudgetApp',
  webDir: 'dist/budgetsite',
  plugins: {
    SafeArea: {
      enabled: true,
    },
  },
};

export default config;
