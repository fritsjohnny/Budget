export interface AnnualSavingsMonth {
  reference: string;
  month: number;
  monthName: string;
  total: number | null;
  quarterAverage: number | null;
  showQuarterAverage: boolean;
  quarterRowSpan: number;
  generalBalance: number | null;
  realGeneralBalance: number | null;
  hasData: boolean;
}

export interface AnnualSavingsReport {
  year: number;
  total: number;
  months: number;
  average: number;
  generalBalance: number;
  realGeneralBalance: number;
  monthRows: AnnualSavingsMonth[];
}

export interface AnnualSavingsConsolidated {
  label: string;
  year?: number;
  total: number;
  months: number;
  average: number;
  isTotal: boolean;
}
