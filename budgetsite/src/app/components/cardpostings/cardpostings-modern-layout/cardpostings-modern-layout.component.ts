import { Component, DoCheck, Input, ViewChild } from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { ExpensesByCategories } from 'src/app/models/expensesbycategories';

@Component({
  selector: 'app-cardpostings-modern-layout',
  templateUrl: './cardpostings-modern-layout.component.html',
  styleUrls: ['./cardpostings-modern-layout.component.scss'],
})
export class CardPostingsModernLayoutComponent implements DoCheck {
  @Input() context!: any;

  private categoriesSort?: MatSort;
  private readonly collator = new Intl.Collator('pt-BR', {
    usage: 'sort',
    sensitivity: 'base',
    numeric: true,
  });

  @ViewChild('modernCategoriesSort')
  set modernCategoriesSort(sort: MatSort | undefined) {
    this.categoriesSort = sort;
    this.bindCategoriesSort();
  }

  ngDoCheck(): void {
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

  get people(): any[] {
    return [...(this.context?.cardpostingspeople ?? [])].sort((a, b) =>
      this.collator.compare(a.person ?? '', b.person ?? '')
    );
  }

  get totalParcels(): number {
    return (this.context?.startingParcels ?? 0) + (this.context?.othersParcels ?? 0) + (this.context?.endingParcels ?? 0);
  }

  get parcelSummaryTotal(): number {
    return this.totalParcels + (this.context?.singleParcels ?? 0);
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
