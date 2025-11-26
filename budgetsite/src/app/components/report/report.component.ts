import { Component, OnInit } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';
import { Categories } from 'src/app/models/categories.model';
import { CategoryService } from 'src/app/services/category/category.service';

@Component({
  selector: 'app-report',
  templateUrl: './report.component.html',
  styleUrls: ['./report.component.scss'],
})

export class ReportComponent implements OnInit {
  initialReference: string | undefined;
  finalReference: string | undefined;
  initialMonthName: string | undefined;
  finalMonthName: string | undefined;
  reportPanelExpanded: boolean = true;
  selectedReportType: number | undefined;
  reportType: number | undefined;
  reports = [
    { id: 1, name: 'Despesas Fixas' },
    { id: 2, name: 'Despesas de Terceiros' },
    { id: 3, name: 'Despesas por Categoria' },
  ];
  showReport: boolean = false;
  categories: Categories[] = [];
  categoryId: number | undefined;

  constructor(private categoryService: CategoryService) { }

  ngOnInit(): void {
    // this.reportPanelExpanded =
    //   localStorage.getItem('reportPanelExpanded') === 'true';

    this.selectedReportType = parseInt(
      localStorage.getItem('lastSelectedReport')!
    );

    // Load categories
    this.categoryService.read().subscribe((categories) => {
      this.categories = categories.sort((a, b) => a.name.localeCompare(b.name));

      this.categoryId = parseInt(
        localStorage.getItem('lastSelectedCategoryReport') || '0'
      );
    });
  }

  initialReferenceChanges(reference: string) {
    this.initialReference = reference;

    // this.referenceHead = this.reference.substr(4, 2) + "/" + this.reference.substr(0, 4);
  }

  finalReferenceChanges(reference: string) {
    this.finalReference = reference;

    // this.referenceHead = this.reference.substr(4, 2) + "/" + this.reference.substr(0, 4);
  }

  reportPanelClosed() {
    localStorage.setItem('reportPanelExpanded', 'false');
  }

  reportPanelOpened() {
    localStorage.setItem('reportPanelExpanded', 'true');
  }

  reportTypeChanges(event: MatSelectChange) {
    this.selectedReportType = event.value;
    localStorage.setItem(
      'lastSelectedReport',
      this.selectedReportType!.toString()
    );
    this.reportType = undefined;
  }

  categoryChanges(event: MatSelectChange) {
    this.categoryId = event.value;
    localStorage.setItem(
      'lastSelectedCategoryReport',
      this.categoryId!.toString()
    );
  }

  generateReport() {
    this.reportPanelExpanded = false; // Collapse the panel
    this.showReport = false;

    setTimeout(() => {
      this.reportType = this.selectedReportType;
      this.showReport = true; // Força a re-renderização
    });
  }
}
