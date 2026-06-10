import { Component, OnInit } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import { AnnualSavingsConsolidated, AnnualSavingsMonth, AnnualSavingsReport } from 'src/app/models/annual-savings.model';
import { AnnualSavingsService } from 'src/app/services/annual-savings/annual-savings.service';

@Component({
  selector: 'app-annual-savings',
  templateUrl: './annual-savings.component.html',
  styleUrls: ['./annual-savings.component.scss']
})
export class AnnualSavingsComponent implements OnInit {

  year: number = new Date().getFullYear();
  report!: AnnualSavingsReport;
  consolidated: AnnualSavingsConsolidated[] = [];
  annualSavingsPanelExpanded: boolean = false;
  showProgress: boolean = false;
  lastUpdated?: Date;
  includeCurrentMonth: boolean = true;
  includeNextMonths: boolean = false;
  includeCurrentYear: boolean = true;
  includeNextYears: boolean = false;

  constructor(private annualSavingsService: AnnualSavingsService) { }

  ngOnInit(): void {
    const storedYear = localStorage.getItem('annualSavingsYear');

    if (storedYear) {
      this.year = parseInt(storedYear);
    }

    this.annualSavingsPanelExpanded = localStorage.getItem('annualSavingsPanelExpanded') === 'true';

    this.refresh();
  }

  refresh() {
    if (!this.year) {
      this.year = new Date().getFullYear();
    }

    localStorage.setItem('annualSavingsYear', this.year.toString());

    this.showProgress = true;

    forkJoin({
      report: this.annualSavingsService.getByYear(this.year, this.includeCurrentMonth, this.includeNextMonths),
      consolidated: this.annualSavingsService.getConsolidated(this.includeCurrentYear, this.includeNextYears, this.includeCurrentMonth, this.includeNextMonths)
    })
      .pipe(finalize(() => this.showProgress = false))
      .subscribe({
        next: ({ report, consolidated }) => {
          this.report = report;
          this.consolidated = consolidated;
          this.lastUpdated = new Date();
        }
      });
  }

  setPreviousYear() {
    this.year--;
    this.refresh();
  }

  setNextYear() {
    this.year++;
    this.refresh();
  }

  setCurrentYear() {
    this.year = new Date().getFullYear();
    this.refresh();
  }

  yearChanged() {
    this.refresh();
  }

  filtersChanged() {
    this.refresh();
  }

  annualSavingsPanelClosed() {
    localStorage.setItem('annualSavingsPanelExpanded', 'false');
  }

  annualSavingsPanelOpened() {
    localStorage.setItem('annualSavingsPanelExpanded', 'true');
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }

    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }

    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  getValueClass(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }

    return value < 0 ? 'negative' : 'positive';
  }

  trackMonth(index: number, row: AnnualSavingsMonth): string {
    return row.reference;
  }

  trackConsolidated(index: number, row: AnnualSavingsConsolidated): string {
    return row.label;
  }
}
