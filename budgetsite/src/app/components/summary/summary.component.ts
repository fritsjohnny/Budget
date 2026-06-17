import { AfterViewInit, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AccountsSummary } from 'src/app/models/accountssummary';
import { AccountsSummaryTotals } from 'src/app/models/accountssummarytotals';
import { AccountService } from 'src/app/services/account/account.service';

interface SaldosLegend {
  reference: string;
  previousReference: string;
  previousReferenceHead: string;
  forecastBalance: number;
  availableBalance: number;
  previousForecastBalance: number;
  previousAvailableBalance: number;
  realForecastBalance: number;
  currentToReceive: number;
  currentToPay: number;
  previousToReceive: number;
  previousToPayDisplay: number;
  forecastSpared: number;
  availableSpared: number;
  drawnBalance: number;
  withoutDrawnBalance: number;
}

@Component({
  selector: 'app-summary',
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.scss']
})
export class SummaryComponent implements OnInit, AfterViewInit {

  reference?: string;
  referenceHead?: string;
  monthName: string = "";
  hideAccountsSummaryProgress: boolean = true;
  hideTotalsAccountsSummaryProgress: boolean = true;
  accountsSummary!: AccountsSummary[];
  totalsAccountsSummary!: AccountsSummaryTotals;
  forecastBalanceTotal: number = 0;
  availableBalanceTotal: number = 0;
  displayedColumns = ['description', 'forecastBalance', 'availableBalance'];
  summaryPanelExpanded: boolean = false;

  saldosLegendExpanded: boolean = false;
  saldosLegend?: SaldosLegend;
  private saldosLegendReference?: string;

  constructor(private cd: ChangeDetectorRef, private accountService: AccountService) { }

  ngOnInit(): void {

    this.summaryPanelExpanded = localStorage.getItem('summaryPanelExpanded') === 'true';

  }

  ngAfterViewInit(): void {

    this.cd.detectChanges();
  }

  referenceChanges(reference: string) {

    this.reference = reference;

    this.referenceHead = this.getReferenceHead(this.reference);

    this.refresh();
  }

  refresh() {

    this.hideAccountsSummaryProgress = false;
    this.hideTotalsAccountsSummaryProgress = false;
    this.invalidateSaldosLegend();

    this.accountService.getAccountsSummary(this.reference).subscribe(
      {
        next: accountsSummary => {

          this.accountsSummary = accountsSummary;

          this.getFooterTotals();
        },
        error: () => {
          this.hideAccountsSummaryProgress = true;
        }
      }
    );

    this.accountService.getTotalsAccountsSummary(this.reference).subscribe(
      {
        next: totalsAccountsSummary => {

          this.totalsAccountsSummary = totalsAccountsSummary;

          this.hideTotalsAccountsSummaryProgress = true;

          if (this.saldosLegendExpanded) {
            this.loadSaldosLegend();
          }
        },
        error: () => {
          this.hideTotalsAccountsSummaryProgress = true;
        }
      }
    );
  }
  getFooterTotals() {

    this.forecastBalanceTotal =
      this.accountsSummary ?
        this.accountsSummary.map(t => t.forecastBalance).reduce((acc, value) => acc + value, 0) :
        0;

    this.availableBalanceTotal =
      this.accountsSummary ?
        this.accountsSummary.map(t => t.availableBalance).reduce((acc, value) => acc + value, 0) :
        0;

    this.hideAccountsSummaryProgress = true;
  }

  summaryPanelClosed() {

    localStorage.setItem('summaryPanelExpanded', 'false');
  }

  summaryPanelOpened() {

    localStorage.setItem('summaryPanelExpanded', 'true');
  }

  saldosLegendOpened() {

    this.saldosLegendExpanded = true;
    this.loadSaldosLegend();
  }

  saldosLegendClosed() {

    this.saldosLegendExpanded = false;
  }

  private loadSaldosLegend() {

    if (!this.reference || !this.totalsAccountsSummary) {
      return;
    }

    if (this.saldosLegend && this.saldosLegendReference === this.reference) {
      return;
    }

    const forecastBalance: number = this.totalsAccountsSummary.forecastBalance ?? 0;
    const availableBalance: number = this.totalsAccountsSummary.availableBalance ?? 0;
    const forecastSpared: number = this.totalsAccountsSummary.forecastSpared ?? 0;
    const availableSpared: number = this.totalsAccountsSummary.availableSpared ?? 0;
    const currentToReceive: number = this.totalsAccountsSummary.toReceive ?? 0;
    const currentToPay: number = this.totalsAccountsSummary.toPay ?? 0;
    const previousReference: string = this.getPreviousReference(this.reference);

    this.saldosLegendReference = this.reference;

    this.saldosLegend = {
      reference: this.reference,
      previousReference: previousReference,
      previousReferenceHead: this.getReferenceHead(previousReference),
      forecastBalance: forecastBalance,
      availableBalance: availableBalance,
      previousForecastBalance: forecastBalance - forecastSpared,
      previousAvailableBalance: availableBalance - availableSpared,
      realForecastBalance: availableBalance + currentToReceive - currentToPay,
      currentToReceive: currentToReceive,
      currentToPay: currentToPay,
      previousToReceive: this.totalsAccountsSummary.previousToReceive ?? 0,
      previousToPayDisplay: (this.totalsAccountsSummary.previousToPay ?? 0) * -1,
      forecastSpared: forecastSpared,
      availableSpared: availableSpared,
      drawnBalance: this.totalsAccountsSummary.drawnBalance ?? 0,
      withoutDrawnBalance: this.totalsAccountsSummary.withoutDrawnBalance ?? 0
    };
  }

  private invalidateSaldosLegend() {

    this.saldosLegend = undefined;
    this.saldosLegendReference = undefined;
  }

  private getPreviousReference(reference: string): string {

    const year: number = Number(reference.substr(0, 4));
    const month: number = Number(reference.substr(4, 2));
    const previousDate: Date = new Date(year, month - 2, 1);
    const previousYear: number = previousDate.getFullYear();
    const previousMonth: string = ('0' + (previousDate.getMonth() + 1)).slice(-2);

    return `${previousYear}${previousMonth}`;
  }

  private getReferenceHead(reference: string): string {

    return reference.substr(4, 2) + "/" + reference.substr(0, 4);
  }
}
