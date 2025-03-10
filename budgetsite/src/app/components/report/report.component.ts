import { Component, OnInit } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';

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
  ];
  showReport: boolean = false;

  constructor() {}

  ngOnInit(): void {
    // this.reportPanelExpanded =
    //   localStorage.getItem('reportPanelExpanded') === 'true';

    this.selectedReportType = parseInt(
      localStorage.getItem('lastSelectedReport')!
    );
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

  generateReport() {
    this.reportPanelExpanded = false; // Collapse the panel
    this.showReport = false;

    setTimeout(() => {
      this.reportType = this.selectedReportType;
      this.showReport = true; // Força a re-renderização
    });
  }
}
