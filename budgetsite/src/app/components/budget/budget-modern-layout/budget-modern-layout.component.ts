import { Component, DoCheck, Input, ViewChild } from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { CardsPostingsDTO } from 'src/app/models/cardspostingsdto.model';
import { ExpensesByCategories } from 'src/app/models/expensesbycategories';

@Component({
  selector: 'app-budget-modern-layout',
  templateUrl: './budget-modern-layout.component.html',
  styleUrls: ['./budget-modern-layout.component.scss'],
})
export class BudgetModernLayoutComponent implements DoCheck {
  @Input() context!: any;

  private peopleSort?: MatSort;
  private categoriesSort?: MatSort;
  private readonly portugueseCollator = new Intl.Collator('pt-BR', {
    usage: 'sort',
    sensitivity: 'base',
    numeric: true,
  });

  @ViewChild('modernPeopleSort')
  set modernPeopleSort(sort: MatSort | undefined) {
    this.peopleSort = sort;
    this.bindModernSorts();
  }

  @ViewChild('modernCategoriesSort')
  set modernCategoriesSort(sort: MatSort | undefined) {
    this.categoriesSort = sort;
    this.bindModernSorts();
  }

  ngDoCheck(): void {
    this.bindModernSorts();
  }

  onReferenceChange(reference: string): void {
    const monthIndex = Number(reference.substring(4, 6)) - 1;
    const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' })
      .format(new Date(2000, monthIndex, 1));

    this.context.monthName = this.capitalize(monthName);
    this.context.referenceChanges(reference);
  }

  get provisionedCategories(): any[] {
    const expenses = this.context?.expensesNoFilter ?? this.context?.expenses ?? [];
    const categories = this.context?.expensesByCategories ?? this.context?.dataSourceCategories?.data ?? [];
    const addedCategories = new Set<string>();

    return expenses
      .filter((expense: any) => Number(expense?.expectedValue ?? 0) > 0)
      .map((expense: any) => {
        const categoryId = Number(expense?.categoryId ?? 0);
        const categoryName = String(expense?.category ?? expense?.description ?? '').trim();
        const normalizedCategoryName = this.normalizeCategoryName(categoryName);
        const category = categories.find((item: any) => {
          if (categoryId > 0 && Number(item?.id ?? 0) === categoryId) return true;

          return this.normalizeCategoryName(item?.category) === normalizedCategoryName;
        });
        const categoryKey = categoryId > 0
          ? `id:${categoryId}`
          : `name:${normalizedCategoryName}`;

        return {
          id: expense?.id,
          key: categoryKey,
          description: category?.category ?? categoryName,
          amount: Number(category?.amount ?? 0),
        };
      })
      .filter((category: any) => {
        if (!category.key || addedCategories.has(category.key)) return false;

        addedCategories.add(category.key);
        return true;
      });
  }

  getExpenseStatus(expense: any): string {
    if (Number(expense?.remaining ?? 0) <= 0 && Number(expense?.toPay ?? 0) > 0) return 'Pago';
    if (Number(expense?.expectedValue ?? 0) > 0 && Number(expense?.toPay ?? 0) <= 0) return 'Provisionado';
    if (expense?.overdue) return 'Vencido';
    if (expense?.duetoday) return 'Vence hoje';

    return 'Pendente';
  }

  getExpenseStatusClass(expense: any): string {
    const status = this.getExpenseStatus(expense);

    if (status === 'Pago') return 'status-paid';
    if (status === 'Provisionado') return 'status-provisioned';
    if (status === 'Vence hoje') return 'status-today';
    if (status === 'Vencido') return 'status-overdue';

    return 'status-pending';
  }

  getExpenseStatusIcon(expense: any): string {
    const status = this.getExpenseStatus(expense);

    if (status === 'Pago') return 'check_circle_outline';
    if (status === 'Provisionado') return 'event_available';
    if (status === 'Vence hoje') return 'notification_important';
    if (status === 'Vencido') return 'error_outline';

    return 'schedule';
  }

  trackById(index: number, item: any): number {
    return item?.id ?? index;
  }

  formatPercentage(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';

    return value.toFixed(2).replace('.', ',') + '%';
  }

  private bindModernSorts(): void {
    if (this.peopleSort && this.context?.dataSourcePeople && this.context.dataSourcePeople.sort !== this.peopleSort) {
      this.context.dataSourcePeople.sortData = (
        data: CardsPostingsDTO[],
        sort: MatSort
      ): CardsPostingsDTO[] => {
        if (!sort.active || sort.direction === '') return data;

        const direction = sort.direction === 'asc' ? 1 : -1;

        return [...data].sort((a, b) => {
          let comparison = 0;

          switch (sort.active) {
            case 'person':
              comparison = this.portugueseCollator.compare(a.person ?? '', b.person ?? '');
              break;

            case 'toReceive':
              comparison = (a.toReceive ?? 0) - (b.toReceive ?? 0);
              break;

            case 'received':
              comparison = (a.received ?? 0) - (b.received ?? 0);
              break;

            case 'remaining':
              comparison = (a.remaining ?? 0) - (b.remaining ?? 0);
              break;
          }

          return comparison * direction;
        });
      };

      this.context.dataSourcePeople.sort = this.peopleSort;
    }

    if (this.categoriesSort && this.context?.dataSourceCategories && this.context.dataSourceCategories.sort !== this.categoriesSort) {
      this.context.dataSourceCategories.sortData = (
        data: ExpensesByCategories[],
        sort: MatSort
      ): ExpensesByCategories[] => {
        if (!sort.active || sort.direction === '') return data;

        const direction = sort.direction === 'asc' ? 1 : -1;

        return [...data].sort((a, b) => {
          let comparison = 0;

          switch (sort.active) {
            case 'category':
              comparison = this.portugueseCollator.compare(a.category ?? '', b.category ?? '');
              break;

            case 'amount':
              comparison = (a.amount ?? 0) - (b.amount ?? 0);
              break;

            case 'perc':
              comparison = (a.perc ?? 0) - (b.perc ?? 0);
              break;
          }

          return comparison * direction;
        });
      };

      this.context.dataSourceCategories.sort = this.categoriesSort;
    }
  }

  private normalizeCategoryName(value: unknown): string {
    return String(value ?? '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');
  }

  private capitalize(value: string): string {
    if (!value) return value;

    return value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1);
  }
}
