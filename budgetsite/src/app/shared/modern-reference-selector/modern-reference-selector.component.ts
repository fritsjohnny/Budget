import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { MAT_DATE_FORMATS } from '@angular/material/core';
import { MatDatepicker } from '@angular/material/datepicker';
import * as _moment from 'moment';
import { default as _rollupMoment, Moment } from 'moment';
import { MY_FORMATS } from '../datepicker/datepicker.component';

const moment = _rollupMoment || _moment;

@Component({
  selector: 'app-modern-reference-selector',
  templateUrl: './modern-reference-selector.component.html',
  styleUrls: ['./modern-reference-selector.component.scss'],
  providers: [{ provide: MAT_DATE_FORMATS, useValue: MY_FORMATS }],
})
export class ModernReferenceSelectorComponent implements OnInit, OnChanges {
  @Input() reference?: string;
  @Input() storageKey = 'modernReferenceDate';
  @Input() ariaLabel = 'Seleção de referência';
  @Input() optionIcon = 'tune';
  @Input() optionTooltip = 'Opções';
  @Input() optionAriaLabel = 'Opções da referência';
  @Input() showOptionButton = true;
  @Input() optionsAsMenu = false;

  @Output() referenceChange = new EventEmitter<string>();
  @Output() optionsClick = new EventEmitter<void>();

  date = new FormControl(moment());

  private initialized = false;
  private synchronizedReference = '';

  ngOnInit(): void {
    moment.locale('pt-BR');

    const referenceDate = this.parseReference(this.reference);
    const storedDate = this.storageKey ? localStorage.getItem(this.storageKey) : null;
    const initialDate = referenceDate
      ?? (storedDate && moment(storedDate).isValid() ? moment(storedDate) : moment());

    this.date.setValue(initialDate);
    this.initialized = true;
    this.emitReference();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized || !changes['reference']) return;

    const referenceDate = this.parseReference(this.reference);

    if (!referenceDate || this.reference === this.synchronizedReference) return;

    this.date.setValue(referenceDate);
    this.synchronizedReference = this.reference!;
  }

  get referenceTitle(): string {
    return this.selectedDate.format('MMMM YYYY').toLocaleUpperCase('pt-BR');
  }

  get referenceHead(): string {
    return this.selectedDate.format('MM/YYYY');
  }

  get previousMonthName(): string {
    return this.capitalize(this.selectedDate.clone().subtract(1, 'month').format('MMMM'));
  }

  get nextMonthName(): string {
    return this.capitalize(this.selectedDate.clone().add(1, 'month').format('MMMM'));
  }

  get isCurrentReference(): boolean {
    return this.selectedDate.format('YYYYMM') === moment().format('YYYYMM');
  }

  chosenYearHandler(normalizedYear: Moment): void {
    const selectedDate = this.selectedDate.clone();
    selectedDate.year(normalizedYear.year());
    this.date.setValue(selectedDate);
  }

  chosenMonthHandler(normalizedMonth: Moment, datepicker: MatDatepicker<Moment>): void {
    const selectedDate = this.selectedDate.clone();
    selectedDate.month(normalizedMonth.month());
    this.date.setValue(selectedDate);
    datepicker.close();
    this.emitReference();
  }

  setPreviousMonth(): void {
    this.date.setValue(this.selectedDate.clone().subtract(1, 'month'));
    this.emitReference();
  }

  setNextMonth(): void {
    this.date.setValue(this.selectedDate.clone().add(1, 'month'));
    this.emitReference();
  }

  setCurrentMonth(): void {
    this.date.setValue(moment());
    this.emitReference();
  }

  openOptions(): void {
    this.optionsClick.emit();
  }

  private get selectedDate(): Moment {
    return this.date.value || moment();
  }

  private emitReference(): void {
    const reference = this.selectedDate.format('YYYYMM');

    this.synchronizedReference = reference;

    if (this.storageKey) {
      localStorage.setItem(this.storageKey, this.selectedDate.toISOString());
    }

    this.referenceChange.emit(reference);
  }

  private parseReference(reference?: string): Moment | null {
    if (!reference || !/^\d{6}$/.test(reference)) return null;

    const parsed = moment(reference, 'YYYYMM', true);
    return parsed.isValid() ? parsed : null;
  }

  private capitalize(value: string): string {
    if (!value) return value;

    return value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1);
  }
}
