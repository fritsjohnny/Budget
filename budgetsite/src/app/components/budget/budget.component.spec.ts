/// <reference types="jasmine" />

import { BudgetTotals } from 'src/app/models/budgettotals';
import { BudgetComponent } from './budget.component';

describe('BudgetComponent - percentuais do saldo previsto', () => {
  function createComponent(
    budgetTotals: Partial<BudgetTotals>,
    expectedBalance: number
  ): BudgetComponent {
    const component = Object.create(BudgetComponent.prototype) as BudgetComponent;
    component.budgetTotals = budgetTotals as BudgetTotals;
    component.expectedBalance = expectedBalance;
    return component;
  }

  it('usa somente os valores próprios mesmo quando o saldo geral inclui terceiros', () => {
    const component = createComponent(
      {
        myIncomes: 1000,
        myExpenses: 400,
        myIncomesWithoutYields: 900,
        myYields: 100
      },
      9999
    );

    expect(component.getExpectedBalanceForMyValues()).toBe(600);
    expect(component.getExpectedBalanceWithoutYields()).toBe(500);
    expect(component.getExpectedBalanceIncomePerc()).toBe(60);
    expect(component.getExpectedBalanceWithoutYieldsIncomePerc()).toBeCloseTo(55.555555, 5);
    expect(component.getExpectedBalanceWithoutYieldsPerc()).toBeCloseTo(83.333333, 5);
    expect(component.getExpectedBalanceYieldsCompositionPerc()).toBeCloseTo(16.666666, 5);
  });

  it('mantém os percentuais de déficit baseados apenas no déficit próprio', () => {
    const component = createComponent(
      {
        myIncomes: 300,
        myExpenses: 500,
        myIncomesWithoutYields: 250,
        myYields: 50
      },
      10000
    );

    expect(component.getExpectedBalanceForMyValues()).toBe(-200);
    expect(component.getExpectedBalanceWithoutYields()).toBe(-250);
    expect(component.getExpectedBalanceDeficitReductionPerc()).toBe(20);
    expect(component.getExpectedBalanceCoveredByYieldsPerc()).toBe(500);
  });

  it('calcula o saldo positivo remanescente dos rendimentos próprios', () => {
    const component = createComponent(
      {
        myIncomes: 360,
        myExpenses: 350,
        myIncomesWithoutYields: 300,
        myYields: 60
      },
      -5000
    );

    expect(component.getExpectedBalanceForMyValues()).toBe(10);
    expect(component.getExpectedBalanceWithoutYields()).toBe(-50);
    expect(component.getExpectedBalancePositiveFromYieldsPerc()).toBeCloseTo(16.666666, 5);
  });
});
