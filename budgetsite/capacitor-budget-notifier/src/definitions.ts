export interface BudgetNotifierPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
  schedule(): Promise<{ success: boolean }>;
}
