import {
  Component,
  OnInit,
  AfterViewInit,
  Inject,
  ChangeDetectorRef,
} from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { Accounts } from 'src/app/models/accounts.model';
import { Cards } from 'src/app/models/cards.model';
import { Incomes } from 'src/app/models/incomes.model';
import { IncomesTypes } from 'src/app/models/types.model';
import { PeopleService } from 'src/app/services/people/people.service';
import { PeopleComponent } from '../people/people.component';
import { ConfirmDialogComponent, ConfirmDialogData } from 'src/app/shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'incomes-dialog',
  templateUrl: 'incomes-dialog.html',
  styleUrls: ['./budget.component.scss'],
})
export class IncomesDialog implements OnInit, AfterViewInit {
  cards?: Cards[];
  accounts?: Accounts[];
  types?: IncomesTypes[];
  isScreenInit: boolean = true;
  disableGenerateParcelsCheck: boolean = true;
  disableRepeatIncomeCheck: boolean = false;

  incomesFormGroup = new FormGroup({
    descriptionFormControl: new FormControl('', Validators.required),
    totalToReceiveFormControl: new FormControl('', Validators.required),
    parcelsFormControl: new FormControl(''),
    toReceiveFormControl: new FormControl('', Validators.required),
    parcelNumberFormControl: new FormControl(''),
    receivedFormControl: new FormControl(''),
    remainingFormControl: new FormControl(''),
    noteFormControl: new FormControl(''),
    cardIdFormControl: new FormControl(''),
    accountIdFormControl: new FormControl(''),
    typeFormControl: new FormControl(''),
    generateParcelsFormControl: new FormControl(''),
    repeatIncomeFormControl: new FormControl(''),
    monthsToRepeatFormControl: new FormControl(''),
    repeatToNextMonthsFormControl: new FormControl(''),
    preserveFutureValuesFormControl: new FormControl(''),
    peopleFormControl: new FormControl(''),
    receiptDateFormControl: new FormControl(''),
  });

  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<IncomesDialog>,
    @Inject(MAT_DIALOG_DATA) public incomes: Incomes,
    private peopleService: PeopleService,
    private cd: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.cards = this.incomes.cardsList;
    this.accounts = this.incomes.accountsList;
    this.types = this.incomes.typesList;

    this.incomes.parcelNumber = this.incomes.parcelNumber ?? 1;
    this.incomes.parcels = this.incomes.parcels ?? 1;
    this.incomes.totalToReceive = this.incomes.totalToReceive ?? this.incomes.toReceive ?? 0;
    this.incomes.monthsToRepeat = 12;
    this.incomes.preserveFutureValues = false;

    this.disableGenerateParcelsCheck =
      this.incomes.parcels == undefined ||
      this.incomes.parcels == null ||
      this.incomes.parcels === 1;
  }

  ngAfterViewInit(): void {
    this.cd.detectChanges();

    this.isScreenInit = false;
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    this.dialogRef.close(this.incomes);
  }

  delete(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: <ConfirmDialogData>{
        title: 'Excluir Receita',
        message: 'Confirma a EXCLUSÃO da receita?',
        confirmText: 'Sim',
        cancelText: 'Cancelar',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.incomes.deleting = true;

        this.dialogRef.close(this.incomes);
      }
    });
  }

  setCard(): void {
    this.incomes.card = this.incomes.cardsList?.find(
      (t) => t.id == this.incomes.cardId
    );
  }

  calculateRemaining(): void {
    this.incomes.received =
      (this.incomes.received ?? 0) > this.incomes.toReceive
        ? this.incomes.toReceive
        : this.incomes.received;
    this.incomes.remaining = +(
      this.incomes.toReceive - (this.incomes.received ?? 0)
    ).toFixed(2);
  }

  calculateToReceive(): void {
    if (this.isScreenInit) return;

    const totalToReceive = this.incomes.totalToReceive ?? this.incomes.toReceive ?? 0;
    const parcels = this.incomes.parcels ?? 1;

    this.incomes.toReceive = +(totalToReceive / parcels).toFixed(2);

    this.calculateRemaining();
  }

  onParcelsChanged(event: any): void {
    this.disableGenerateParcelsCheck =
      event.target.value == '' || this.incomes.parcels! <= 1;

    this.incomes.generateParcels = !this.disableGenerateParcelsCheck;

    this.onGenerateParcelsChanged(null);

    if (event.target.value == '') {
      this.incomes.parcels = 1;
    }

    this.calculateToReceive();
  }

  onGenerateParcelsChanged(event: any): void {
    if (this.incomes.generateParcels) {
      this.disableRepeatIncomeCheck = true;
      this.incomes.repeatIncome = false;
      this.incomes.repeatToNextMonths = false;
      this.incomes.preserveFutureValues = false;
      this.incomesFormGroup.get('monthsToRepeatFormControl')!.disable();
    } else {
      this.disableRepeatIncomeCheck = false;
      this.incomesFormGroup.get('monthsToRepeatFormControl')!.enable();
    }
  }

  onRepeatIncomeChanged(event: any): void {
    if (this.incomes.repeatIncome) {
      this.disableGenerateParcelsCheck = true;
      this.incomes.generateParcels = false;
      this.incomes.repeatToNextMonths = false;
      this.incomes.preserveFutureValues = false;
    } else {
      if (this.incomes.parcels! > 1) {
        this.disableGenerateParcelsCheck = false;
      }
    }
  }

  onRepeatToNextMonthsChanged(): void {
    if (!this.incomes.repeatToNextMonths) {
      this.incomes.preserveFutureValues = false;
    }
  }

  setTitle() {
    return 'Receita - ' + (this.incomes.editing ? 'Editar' : 'Incluir');
  }

  addPeople() {
    const dialogRef = this.dialog.open(PeopleComponent, {
      width: '400px',
      data: this.incomes.peopleList!.find(p => p.id === this.incomes.peopleId),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.peopleService.create(result).subscribe({
          next: (people) => {
            this.incomes.peopleList = [
              ...this.incomes.peopleList!,
              people,
            ].sort((a, b) => a.name.localeCompare(b.name));
            this.incomes.peopleId = people.id;
          },
        });
      }
    });
  }
}
