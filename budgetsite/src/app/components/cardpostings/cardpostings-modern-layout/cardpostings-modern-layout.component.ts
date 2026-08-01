import { Component, Input, ViewChild } from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { ExpensesByCategories } from 'src/app/models/expensesbycategories';

@Component({
  selector: 'app-cardpostings-modern-layout',
  templateUrl: './cardpostings-modern-layout.component.html',
  styleUrls: ['./cardpostings-modern-layout.component.scss'],
})
export class CardPostingsModernLayoutComponent {
  @Input() context!: any;

  private categoriesSort?: MatSort;
  private peopleSource?: any[];
  private sortedPeople: any[] = [];
  private categoriesSource?: any[];
  private categoryNames = new Map<number, string>();
  private readonly collator = new Intl.Collator('pt-BR', {
    usage: 'sort',
    sensitivity: 'base',
    numeric: true,
  });
  private readonly weekdayFormatter = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
  });

  @ViewChild('modernCategoriesSort')
  set modernCategoriesSort(sort: MatSort | undefined) {
    this.categoriesSort = sort;
    this.bindCategoriesSort();
  }


  get activeFilterCount(): number {
    const filters = [
      this.context?.hideFuturePurchases,
      this.context?.justMyShopping,
      this.context?.justOthersShopping,
      this.context?.justSingleParcel,
      this.context?.justFirstParcel,
      this.context?.justLastParcel,
      this.context?.justOthersParcels,
      this.context?.checkCard,
    ];

    return filters.filter(Boolean).length;
  }

  get postings(): any[] {
    return this.context?.dataSource?.filteredData ?? this.context?.cardpostings ?? [];
  }

  get selectedCard(): any | undefined {
    if (!this.context?.cardId || this.context.cardId <= 0) return undefined;

    return this.context?.cardsList?.find((card: any) => card.id === this.context.cardId);
  }

  get selectedCardBestPurchaseDay(): number | string | undefined {
    const invoiceStartDate = this.context?.currentInvoiceClosing?.closingDate;
    if (invoiceStartDate) {
      const date = new Date(invoiceStartDate);
      if (!Number.isNaN(date.getTime())) return date.getDate();
    }

    return this.selectedCard?.closingDay;
  }

  get selectedCardExpenseDueDate(): string | Date | undefined {
    return this.selectedCard?.expenseDueDate;
  }

  get people(): any[] {
    const source = this.context?.cardpostingspeople ?? [];

    if (source !== this.peopleSource) {
      this.peopleSource = source;
      this.sortedPeople = [...source].sort((a, b) =>
        this.collator.compare(a.person ?? '', b.person ?? '')
      );
    }

    return this.sortedPeople;
  }

  get totalParcels(): number {
    return (this.context?.startingParcels ?? 0) + (this.context?.othersParcels ?? 0) + (this.context?.endingParcels ?? 0);
  }

  get parcelSummaryTotal(): number {
    return this.totalParcels + (this.context?.singleParcels ?? 0);
  }

  getCategoryName(posting: any): string {
    const categoryName = String(posting?.category ?? '').trim();
    if (categoryName) return categoryName;

    if (posting?.categoryId == null) return '';

    const categories = this.context?.categoriesList ?? [];

    if (categories !== this.categoriesSource) {
      this.categoriesSource = categories;
      this.categoryNames = new Map(
        categories.map((category: any) => [category.id, String(category.name ?? '').trim()])
      );
    }

    return this.categoryNames.get(posting.categoryId) ?? '';
  }

  getWeekday(date: string | Date): string {
    return this.weekdayFormatter
      .format(new Date(date))
      .replace('.', '')
      .toLowerCase();
  }

  isFuturePosting(date: string | Date): boolean {
    const postingDate = new Date(date);
    const today = new Date();
    postingDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return postingDate.getTime() > today.getTime();
  }

  trackById(index: number, item: any): number {
    return item?.id ?? index;
  }

  private bindCategoriesSort(): void {
    if (!this.categoriesSort || !this.context?.dataSourceCategories || this.context.dataSourceCategories.sort === this.categoriesSort) return;

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
            comparison = this.collator.compare(a.category ?? '', b.category ?? '');
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
