import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  Inject,
  ChangeDetectorRef,
  ElementRef,
} from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { CardsPostings } from 'src/app/models/cardspostings.model';
import { CategoryService } from 'src/app/services/category/category.service';
import { PeopleService } from 'src/app/services/people/people.service';
import { DatepickerinputComponent } from 'src/app/shared/datepickerinput/datepickerinput.component';
import { CategoryComponent } from '../../category/category.component';
import { PeopleComponent } from '../../people/people.component';
import { CardPostingsService } from 'src/app/services/cardpostings/cardpostings.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from 'src/app/shared/confirm-dialog/confirm-dialog.component';
import { ExpenseService } from 'src/app/services/expense/expense.service';
import { CardsInvoiceClosingService } from 'src/app/services/cardsinvoiceclosing/cardsinvoiceclosing.service';
import { Messenger } from 'src/app/common/messenger';
import { formatReference } from 'src/app/common/reference';
import { finalize } from 'rxjs/operators';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'cardpostings-dialog',
  templateUrl: 'cardpostings-dialog.html',
  styleUrls: ['../../cardpostings/cardpostings.component.scss'],
})
export class CardPostingsDialog implements OnInit, AfterViewInit {
  @ViewChild('datepickerinput') datepickerinput!: DatepickerinputComponent;
  @ViewChild('descriptionInput') descriptionInput!: ElementRef;

  disableCheck: boolean = true;
  isScreenInit: boolean = true;

  disableGenerateParcelsCheck: boolean = true;
  disableRepeatParcelsCheck: boolean = false;
  hasExistingParcelSequence: boolean = false;

  cardPostingFormGroup = new FormGroup({
    cardIdFormControl: new FormControl('', Validators.required),
    descriptionFormControl: new FormControl('', Validators.required),
    totalAmountFormControl: new FormControl('', Validators.required),
    amountFormControl: new FormControl('', Validators.required),
    parcelsFormControl: new FormControl('', Validators.min(1)),
    parcelNumberFormControl: new FormControl('', [
      Validators.required,
      Validators.min(1),
    ]),
    peopleFormControl: new FormControl(''),
    noteFormControl: new FormControl(''),
    generateParcelsFormControl: new FormControl(''),
    categoryIdFormControl: new FormControl(''),
    repeatParcelsFormControl: new FormControl(''),
    monthsToRepeatFormControl: new FormControl(''),
    fixedFormControl: new FormControl(''),
    provisionedFormControl: new FormControl(false),
    repeatToNextMonthsFormControl: new FormControl(''),
    preserveFutureValuesFormControl: new FormControl(''),
    idFormControl: new FormControl(''),
    relatedIdFormControl: new FormControl(''),
    dueDateFormControl: new FormControl(''),
    isPaidFormControl: new FormControl(''),
    expenseIdFormControl: new FormControl(''),
    allowClosedInvoiceOperationFormControl: new FormControl(false),
  });
  validatingInvoiceClosing = false;
  invoiceClosingLoaded = false;
  invoiceClosingLoadFailed = false;
  referenceListsLoading = false;
  referenceListsLoaded = false;
  referenceListsLoadFailed = false;
  private invoiceClosingRequestId = 0;
  private referenceListsRequestId = 0;
  private descriptionSuggestionLoading = false;
  readonly formatReference = formatReference;

  get requiresClosedInvoiceOverride(): boolean {
    return this.cardPosting.sourceInvoiceClosing?.isClosed === true || this.cardPosting.invoiceClosing?.isClosed === true;
  }
  get invoiceOperationBlocked(): boolean {
    return this.requiresClosedInvoiceOverride && this.cardPosting.allowClosedInvoiceOperation !== true;
  }
  get businessFieldsBlocked(): boolean {
    return this.validatingInvoiceClosing || !this.invoiceClosingLoaded || this.invoiceClosingLoadFailed ||
      this.referenceListsLoading || !this.referenceListsLoaded || this.referenceListsLoadFailed || this.invoiceOperationBlocked;
  }
  get canSave(): boolean {
    return this.cardPostingFormGroup.valid && this.cardPosting.cardId > 0 &&
      /^\d{6}$/.test(this.cardPosting.reference ?? '') && !this.validatingInvoiceClosing &&
      this.invoiceClosingLoaded && !this.invoiceClosingLoadFailed && !this.referenceListsLoading &&
      this.referenceListsLoaded && !this.referenceListsLoadFailed && !this.invoiceOperationBlocked;
  }
  get canChangeInvoiceContext(): boolean {
    return !this.validatingInvoiceClosing && !this.referenceListsLoading;
  }

  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<CardPostingsDialog>,
    @Inject(MAT_DIALOG_DATA) public cardPosting: CardsPostings,
    private categoryService: CategoryService,
    private peopleService: PeopleService,
    private cardPostingsService: CardPostingsService,
    private expenseService: ExpenseService,
    private cd: ChangeDetectorRef,
    private invoiceClosingService: CardsInvoiceClosingService,
    private messenger: Messenger
  ) { }

  ngOnInit(): void {
    this.cardPosting.allowClosedInvoiceOperation = false;
    this.invoiceClosingLoaded = !!this.cardPosting.invoiceClosing &&
      this.cardPosting.invoiceClosing.cardId === this.cardPosting.cardId &&
      this.cardPosting.invoiceClosing.reference === this.cardPosting.reference;
    this.cardPosting.provisioned = this.cardPosting.provisioned ?? false;

    const originalParcels = this.cardPosting.parcels ?? 1;
    const isCloning = this.cardPosting.cloning === true;

    this.hasExistingParcelSequence =
      this.cardPosting.editing === true &&
      originalParcels > 1;

    this.disableCheck =
      isCloning ||
      this.hasExistingParcelSequence ||
      originalParcels <= 1;

    this.disableGenerateParcelsCheck = this.disableCheck;

    if (isCloning || this.hasExistingParcelSequence) {
      this.cardPosting.generateParcels = false;
    }

    this.cardPosting.monthsToRepeat = 12;
    this.cardPosting.repeatToNextMonths = false;
    this.cardPosting.preserveFutureValues = false;

    this.getLists();
    this.loadReferenceDependentLists(this.cardPosting.reference, false);
    this.applyBusinessControlState();
  }

  ngAfterViewInit(): void {
    if (!this.cardPosting.id) {
      this.cardPosting.date = this.datepickerinput.date.value._d;
    }

    this.cd.detectChanges();

    this.isScreenInit = false;

    this.applyAutomaticSuggestions();

    if (this.cardPosting.adding && !this.cardPosting.description) {
      setTimeout(() => {
        this.descriptionInput.nativeElement.focus();
      }, 500);
    }

    if (!this.cardPosting.editing && !this.cardPosting.cloning) {
      if (this.cardPosting.parcels! > 1) {
        this.atualizarParcelamento(this.cardPosting.parcels!);
        this.calculateAmount();
      }
    } else {
      this.cardPosting.generateParcels = false;
    }
  }

  getLists() {
    this.peopleService.read().subscribe({
      next: (people) => {
        this.cardPosting.peopleList = (people ?? []).sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        this.setPeople();
      },
    });

  }

  cancel(): void {
    this.dialogRef.close();
  }

  currentDateChanged(date: Date) {
    this.cardPosting.date = date;
  }

  save(): void {
    if (!this.canSave) {
      this.messenger.errorHandler('Autorize a operação na fatura fechada para continuar.');
      return;
    }
    this.cardPosting.allowClosedInvoiceOperation = this.cardPosting.allowClosedInvoiceOperation === true;
    if (this.hasExistingParcelSequence) {
      this.cardPosting.generateParcels = false;
    }

    if (this.cardPosting.payWithCard) {
      localStorage.setItem('lastCardUsed', this.cardPosting.cardId.toString());
    }

    this.dialogRef.close(this.cardPosting);
  }

  delete(): void {
    if (this.invoiceOperationBlocked) {
      this.messenger.errorHandler('Autorize a exclusão na fatura fechada para continuar.');
      return;
    }
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: <ConfirmDialogData>{
        title: 'Excluir Compra',
        message: 'Confirma a EXCLUSÃO da compra?',
        confirmText: 'Sim',
        cancelText: 'Cancelar',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.cardPosting.deleting = true;

        this.dialogRef.close(this.cardPosting);
      }
    });
  }

  onClosedInvoiceAuthorizationChanged(): void {
    this.cardPosting.allowClosedInvoiceOperation = this.cardPosting.allowClosedInvoiceOperation === true;
    this.applyBusinessControlState();
    this.applyAutomaticSuggestions();
  }

  onCardChanged(cardId: number): void {
    this.loadInvoiceClosing(cardId, this.cardPosting.reference);
  }

  onReferenceChanged(reference: string): void {
    if (!/^\d{6}$/.test(reference ?? '')) return;
    if (reference === this.cardPosting.reference) return;
    this.cardPosting.reference = reference;
    this.loadInvoiceClosing(this.cardPosting.cardId, reference);
    this.loadReferenceDependentLists(reference, true);
  }

  loadReferenceDependentLists(
    reference: string,
    clearReferenceDependentSelection: boolean
  ): void {
    if (!/^\d{6}$/.test(reference ?? '')) return;
    const requestId = ++this.referenceListsRequestId;

    const expenseIdToPreserve = clearReferenceDependentSelection
      ? undefined
      : this.cardPosting.expenseId;

    if (clearReferenceDependentSelection) {
      this.cardPosting.expenseId = undefined;
      this.cardPostingFormGroup.get('expenseIdFormControl')?.reset(null, { emitEvent: false });
    }
    this.cardPosting.expensesList = [];
    this.referenceListsLoading = true;
    this.referenceListsLoaded = false;
    this.referenceListsLoadFailed = false;
    this.applyBusinessControlState();

    forkJoin({
      categories: this.categoryService.readWithExpenses(reference),
      expenses: this.expenseService.readComboList(reference)
    }).pipe(finalize(() => {
      if (requestId !== this.referenceListsRequestId) return;
      if (this.cardPosting.reference === reference) {
        this.referenceListsLoading = false;
        this.applyBusinessControlState();
        this.applyAutomaticSuggestions();
      }
    })).subscribe({
      next: ({ categories, expenses }) => {
        if (requestId !== this.referenceListsRequestId) return;
        if (this.cardPosting.reference !== reference) return;

        this.cardPosting.categoriesList = (categories ?? []).sort((a, b) => a.name.localeCompare(b.name));
        this.cardPosting.expensesList = (expenses ?? []).sort((a, b) => a.description.localeCompare(b.description));

        const selectedExpenseExists = expenseIdToPreserve != null &&
          this.cardPosting.expensesList.some(expense => expense.id === expenseIdToPreserve);

        if (selectedExpenseExists) {
          this.cardPosting.expenseId = expenseIdToPreserve;
          this.cardPostingFormGroup.get('expenseIdFormControl')?.setValue(expenseIdToPreserve, { emitEvent: false });
        } else if (!clearReferenceDependentSelection && expenseIdToPreserve != null) {
          this.cardPosting.expenseId = undefined;
          this.cardPostingFormGroup.get('expenseIdFormControl')?.reset(null, { emitEvent: false });
        }

        if (this.cardPosting.categoryId != null &&
          !this.cardPosting.categoriesList.some(category => category.id === this.cardPosting.categoryId)) {
          this.cardPosting.categoryId = undefined;
          this.cardPostingFormGroup.get('categoryIdFormControl')?.reset(null, { emitEvent: false });
        }

        this.referenceListsLoaded = true;
        this.referenceListsLoadFailed = false;
      },
      error: () => {
        if (requestId !== this.referenceListsRequestId) return;
        if (this.cardPosting.reference !== reference) return;
        this.cardPosting.categoriesList = [];
        this.cardPosting.expensesList = [];
        this.referenceListsLoaded = false;
        this.referenceListsLoadFailed = true;
      }
    });
  }

  loadInvoiceClosing(cardId: number, reference: string): void {
    const requestId = ++this.invoiceClosingRequestId;

    this.cardPosting.invoiceClosing = undefined;
    this.cardPosting.allowClosedInvoiceOperation = false;
    this.invoiceClosingLoaded = false;
    this.invoiceClosingLoadFailed = false;

    if (!cardId || cardId <= 0 || !/^\d{6}$/.test(reference ?? '')) {
      this.applyBusinessControlState();
      return;
    }

    this.validatingInvoiceClosing = true;
    this.applyBusinessControlState();
    this.invoiceClosingService.ensure(cardId, reference).pipe(
      finalize(() => {
        if (requestId !== this.invoiceClosingRequestId) return;
        this.validatingInvoiceClosing = false;
        this.applyBusinessControlState();
        this.applyAutomaticSuggestions();
      })
    ).subscribe({
      next: closing => {
        if (requestId !== this.invoiceClosingRequestId) return;
        if (this.cardPosting.cardId !== cardId || this.cardPosting.reference !== reference) return;
        this.cardPosting.invoiceClosing = closing;
        this.invoiceClosingLoaded = true;
        this.invoiceClosingLoadFailed = false;
      },
      error: () => {
        if (requestId !== this.invoiceClosingRequestId) return;
        if (this.cardPosting.cardId !== cardId || this.cardPosting.reference !== reference) return;
        this.invoiceClosingLoaded = false;
        this.invoiceClosingLoadFailed = true;
      }
    });
  }

  private applyBusinessControlState(): void {
    const override = this.cardPostingFormGroup.get('allowClosedInvoiceOperationFormControl');
    if (this.businessFieldsBlocked) {
      Object.keys(this.cardPostingFormGroup.controls).forEach(name => {
        if (name !== 'allowClosedInvoiceOperationFormControl') this.cardPostingFormGroup.get(name)?.disable({ emitEvent: false });
      });
      if (this.canChangeInvoiceContext) this.cardPostingFormGroup.get('cardIdFormControl')?.enable({ emitEvent: false });
      if (this.invoiceClosingLoaded && this.requiresClosedInvoiceOverride) override?.enable({ emitEvent: false });
      else override?.disable({ emitEvent: false });
      return;
    }
    Object.keys(this.cardPostingFormGroup.controls).forEach(name => this.cardPostingFormGroup.get(name)?.enable({ emitEvent: false }));
    if (this.hasExistingParcelSequence || this.disableCheck) this.cardPostingFormGroup.get('generateParcelsFormControl')?.disable({ emitEvent: false });
    if (this.cardPosting.generateParcels) this.cardPostingFormGroup.get('monthsToRepeatFormControl')?.disable({ emitEvent: false });
    if (!this.cardPosting.repeatToNextMonths) this.cardPostingFormGroup.get('preserveFutureValuesFormControl')?.disable({ emitEvent: false });
    override?.enable({ emitEvent: false });
  }

  closedInvoiceMessage(): string {
    const closing = this.cardPosting.sourceInvoiceClosing?.isClosed ? this.cardPosting.sourceInvoiceClosing : this.cardPosting.invoiceClosing;
    if (!closing) return '';
    const cardName = closing.cardName || this.cardPosting.cardsList?.find(card => card.id === closing.cardId)?.name || 'selecionado';
    const date = new Date(closing.closingDate).toLocaleDateString('pt-BR');
    return `A fatura ${formatReference(closing.reference)} do cartão ${cardName} foi fechada em ${date}. Para continuar, marque a permissão abaixo.`;
  }

  setPeople(): void {
    this.cardPosting.people = this.cardPosting.peopleList?.find(
      (t) => t.id == this.cardPosting.peopleId
    );
  }

  onParcelsChanged(event: any): void {
    const value = event.target.value;
    this.atualizarParcelamento(value);
    this.calculateAmount();
  }

  private atualizarParcelamento(
    parcels: number | string
  ): void {
    const val = +parcels;

    this.disableCheck =
      this.hasExistingParcelSequence ||
      parcels === '' ||
      val <= 1;

    this.disableGenerateParcelsCheck =
      this.disableCheck;

    if (this.disableCheck) {
      this.cardPosting.generateParcels = false;
    } else {
      this.cardPosting.generateParcels = true;
    }

    if (parcels === '') {
      this.cardPosting.parcels = 1;
    }
  }

  onGenerateParcelsChanged(): void {
    if (this.hasExistingParcelSequence) {
      this.cardPosting.generateParcels = false;
      return;
    }

    if (this.cardPosting.generateParcels) {
      this.disableRepeatParcelsCheck = true;

      this.cardPosting.repeatParcels = false;
      this.cardPosting.repeatToNextMonths = false;
      this.cardPosting.preserveFutureValues = false;

      this.cardPostingFormGroup
        .get('monthsToRepeatFormControl')!
        .disable();
    } else {
      this.disableRepeatParcelsCheck = false;

      this.cardPostingFormGroup
        .get('monthsToRepeatFormControl')!
        .enable();
    }
  }

  onParcelNumberChanged(event: any): void {
    if (event.target.value == '') {
      this.cardPosting.parcelNumber = 1;
    }
  }

  calculateAmount(): void {
    if (this.isScreenInit) return;

    this.cardPosting.amount = +(
      this.cardPosting.totalAmount! / this.cardPosting.parcels!
    ).toFixed(2);
  }

  setTitle() {
    return 'Compra - ' + (this.cardPosting.editing ? 'Editar' : 'Incluir');
  }

  addPeople() {
    const dialogRef = this.dialog.open(PeopleComponent, {
      width: '400px',
      data: this.cardPosting.peopleList!.find(p => p.id === this.cardPosting.peopleId),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.peopleService.create(result).subscribe({
          next: (people) => {
            this.cardPosting.peopleList = [
              ...this.cardPosting.peopleList!,
              people,
            ].sort((a, b) => a.name.localeCompare(b.name));

            this.cardPosting.peopleId = people.id;
          },
        });
      }
    });
  }

  addCategory() {

    const dialogRef = this.dialog.open(CategoryComponent, {
      width: '400px',
      data: this.cardPosting.categoriesList!.find(c => c.id === this.cardPosting.categoryId),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.categoryService.create(result).subscribe({
          next: (category) => {
            this.cardPosting.categoriesList = [
              ...this.cardPosting.categoriesList!,
              category,
            ].sort((a, b) => a.name.localeCompare(b.name));
            this.cardPosting.categoryId = category.id;
          },
        });
      }
    });
  }

  onRepeatParcelsChanged(event: any): void {
    if (this.cardPosting.repeatParcels) {
      this.disableCheck = true;
      this.disableGenerateParcelsCheck = true;

      this.cardPosting.generateParcels = false;
      this.cardPosting.repeatToNextMonths = false;
      this.cardPosting.preserveFutureValues = false;
    } else {
      const shouldDisable =
        this.hasExistingParcelSequence ||
        this.cardPosting.parcels! <= 1;

      this.disableCheck = shouldDisable;
      this.disableGenerateParcelsCheck =
        shouldDisable;
    }

    if (this.hasExistingParcelSequence) {
      this.cardPosting.generateParcels = false;
    }
  }

  onRepeatToNextMonthsChanged(): void {
    if (!this.cardPosting.repeatToNextMonths) {
      this.cardPosting.preserveFutureValues = false;
    }
  }

  onDescriptionChange(): void {
    if (this.businessFieldsBlocked) return;
    if (!this.cardPosting.description) return;
    if (this.descriptionSuggestionLoading) return;

    if (this.cardPosting.categoryId != null && this.cardPosting.peopleId != null) {
      this.suggestExpenseFromCategory();
      return;
    }

    this.descriptionSuggestionLoading = true;

    this.cardPostingsService
      .getCategoryByDescription(this.cardPosting.description)
      .pipe(
        finalize(() => {
          this.descriptionSuggestionLoading = false;
        })
      )
      .subscribe({
        next: (suggestion) => {
          this.applyDescriptionSuggestion(suggestion);
        },
      });
  }

  private applyAutomaticSuggestions(): void {
    if (this.businessFieldsBlocked || !this.cardPosting.description) {
      return;
    }

    const needsDescriptionSuggestion =
      this.cardPosting.categoryId == null ||
      this.cardPosting.peopleId == null;

    if (needsDescriptionSuggestion) {
      this.onDescriptionChange();
      return;
    }

    this.suggestExpenseFromCategory();
  }

  private applyDescriptionSuggestion(suggestion: Partial<CardsPostings> | null | undefined): void {
    if (suggestion) {
      if (this.cardPosting.categoryId == null && suggestion.categoryId != null) {
        this.cardPosting.categoryId = suggestion.categoryId;
        this.cardPostingFormGroup.get('categoryIdFormControl')?.setValue(suggestion.categoryId, { emitEvent: false });
      }

      if (this.cardPosting.peopleId == null && suggestion.peopleId != null) {
        this.cardPosting.peopleId = suggestion.peopleId;
        this.cardPostingFormGroup.get('peopleFormControl')?.setValue(suggestion.peopleId, { emitEvent: false });
        this.setPeople();
      }
    }

    this.suggestExpenseFromCategory();
  }

  private normalizeSuggestionText(value?: string | null): string {
    return (value ?? '').trim().toLocaleLowerCase('pt-BR');
  }

  private suggestExpenseFromCategory(force: boolean = false): void {
    if (this.businessFieldsBlocked) return;
    if (!force && this.cardPosting.expenseId != null) {
      return;
    }

    const category = this.cardPosting.categoriesList?.find(c => c.id === this.cardPosting.categoryId);

    if (!category?.hasExpense) {
      return;
    }

    const categoryName = this.normalizeSuggestionText(category.name);

    const expense = this.cardPosting.expensesList?.find(
      e => this.normalizeSuggestionText(e.description) === categoryName && e.categoryId == null
    );

    if (!expense?.id) {
      return;
    }

    this.cardPosting.expenseId = expense.id;
    this.cardPostingFormGroup.get('expenseIdFormControl')?.setValue(expense.id, { emitEvent: false });
  }

  setPositiveOrNegative() {
    this.cardPosting.totalAmount = this.cardPosting.totalAmount! * -1;
    this.cardPosting.amount = this.cardPosting.amount * -1;
  }

  onCategorySelected(categoryId?: number): void {
    this.cardPosting.categoryId = categoryId;
    this.suggestExpenseFromCategory(true);
  }
}
