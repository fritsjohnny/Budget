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
    repeatToNextMonthsFormControl: new FormControl(''),
    idFormControl: new FormControl(''),
    relatedIdFormControl: new FormControl(''),
    dueDateFormControl: new FormControl(''),
    isPaidFormControl: new FormControl(''),
    expenseIdFormControl: new FormControl(''),
  });

  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<CardPostingsDialog>,
    @Inject(MAT_DIALOG_DATA) public cardPosting: CardsPostings,
    private categoryService: CategoryService,
    private peopleService: PeopleService,
    private cardPostingsService: CardPostingsService,
    private expenseService: ExpenseService,
    private cd: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    const originalParcels =
      this.cardPosting.parcels ?? 1;

    this.hasExistingParcelSequence =
      this.cardPosting.editing === true &&
      originalParcels > 1;

    this.disableCheck =
      this.hasExistingParcelSequence ||
      originalParcels <= 1;

    this.disableGenerateParcelsCheck =
      this.disableCheck;

    if (this.hasExistingParcelSequence) {
      this.cardPosting.generateParcels = false;
    }

    this.cardPosting.monthsToRepeat = 12;

    this.getLists();
  }

  ngAfterViewInit(): void {
    if (!this.cardPosting.id) {
      this.cardPosting.date = this.datepickerinput.date.value._d;
    }

    if (this.cardPosting.payWithCard) {
      const lastCardUsed = localStorage.getItem('lastCardUsed');

      if (lastCardUsed) {
        this.cardPosting.cardId = Number(lastCardUsed);
      }
    }

    this.cd.detectChanges();

    this.isScreenInit = false;

    if (this.cardPosting.description) {
      this.onDescriptionChange();
    }

    if (this.cardPosting.adding && !this.cardPosting.description) {
      setTimeout(() => {
        this.descriptionInput.nativeElement.focus();
      }, 500);
    }

    if (!this.cardPosting.editing) {
      if (this.cardPosting.parcels! > 1) {
        this.atualizarParcelamento(this.cardPosting.parcels!);
        this.calculateAmount();
      }
    }
    else {
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

    this.categoryService.readWithExpenses(this.cardPosting.reference!).subscribe({
      next: (categories) => {
        this.cardPosting.categoriesList = categories.sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        this.suggestExpenseFromCategory();
      },
    });

    this.expenseService.readComboList(this.cardPosting.reference!).subscribe({
      next: (expenses) => {
        this.cardPosting.expensesList = expenses.sort((a, b) =>
          a.description.localeCompare(b.description));

        this.suggestExpenseFromCategory();
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
    if (this.hasExistingParcelSequence) {
      this.cardPosting.generateParcels = false;
    }

    if (this.cardPosting.payWithCard) {
      localStorage.setItem('lastCardUsed', this.cardPosting.cardId.toString());
    }

    this.dialogRef.close(this.cardPosting);
  }

  delete(): void {
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
    } else {
      const shouldDisable =
        this.hasExistingParcelSequence ||
        this.cardPosting.parcels! <= 1;

      this.disableCheck = shouldDisable;
      this.disableGenerateParcelsCheck = shouldDisable;
    }

    if (this.hasExistingParcelSequence) {
      this.cardPosting.generateParcels = false;
    }
  }

  onDescriptionChange() {
    if (!this.cardPosting.description) return;

    if (this.cardPosting.categoryId != null && this.cardPosting.peopleId != null) {
      return;
    }

    this.cardPostingsService
      .getCategoryByDescription(this.cardPosting.description)
      .subscribe({
        next: (suggestion) => {
          this.applyDescriptionSuggestion(suggestion);
        },
      });
  }

  private applyDescriptionSuggestion(suggestion: Partial<CardsPostings> | null | undefined): void {
    if (!suggestion) {
      return;
    }

    if (this.cardPosting.categoryId == null && suggestion.categoryId != null) {
      this.cardPosting.categoryId = suggestion.categoryId;
      this.cardPostingFormGroup.get('categoryIdFormControl')?.setValue(suggestion.categoryId, { emitEvent: false });
    }

    if (this.cardPosting.peopleId == null && suggestion.peopleId != null) {
      this.cardPosting.peopleId = suggestion.peopleId;
      this.cardPostingFormGroup.get('peopleFormControl')?.setValue(suggestion.peopleId, { emitEvent: false });
      this.setPeople();
    }

    this.suggestExpenseFromCategory();
  }

  private normalizeSuggestionText(value?: string | null): string {
    return (value ?? '').trim().toLocaleLowerCase('pt-BR');
  }

  private suggestExpenseFromCategory(force: boolean = false): void {
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

  onCategorySelected() {
    this.suggestExpenseFromCategory(true);
  }
}
