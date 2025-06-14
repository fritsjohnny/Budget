export interface BudgetNotifierPluginPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
}
