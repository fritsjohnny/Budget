import { Component, OnInit, AfterViewInit, ViewChild, Inject } from '@angular/core';
import { AbstractControl, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { AccountsApplications } from 'src/app/models/accountsapplications.model';
import { AccountApplicationsService } from 'src/app/services/accountapplications/accountapplications.service';
import { DatepickerinputComponent } from 'src/app/shared/datepickerinput/datepickerinput.component';
import { ConfirmDialogComponent, ConfirmDialogData } from 'src/app/shared/confirm-dialog/confirm-dialog.component';

@Component({
    selector: 'accountapplications-dialog',
    templateUrl: 'accountapplications-dialog.html',
    styleUrls: ['accountapplications-dialog.scss'],
})
export class AccountApplicationsDialog implements OnInit, AfterViewInit {

    @ViewChild('datepickerinput') datepickerinput!: DatepickerinputComponent;

    accountApplicationFormGroup = new FormGroup({
        accountIdFormControl: new FormControl('', Validators.required),
        amountAppliedFormControl: new FormControl('', Validators.required),
        maximumAmountFormControl: new FormControl('', [Validators.min(0.01), this.maximumAmountValidator]),
        cdiPercentFormControl: new FormControl('', Validators.required),
        fixedRateFormControl: new FormControl(''),
        maturityDateFormControl: new FormControl(''),
    });

    accountApplication: AccountsApplications;

    private maximumAmountValidator(control: AbstractControl) {
        const value = control.value;
        if (value === '' || value === null || value === undefined) return null;
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric > 0 ? null : { invalidMaximum: true };
    }

    constructor(
        public dialog: MatDialog,
        public dialogRef: MatDialogRef<AccountApplicationsDialog>,
        @Inject(MAT_DIALOG_DATA) public data: AccountsApplications,
    ) {
        this.accountApplication = data;
    }

    ngOnInit(): void {
        if (!this.accountApplication.dateApplied) this.accountApplication.dateApplied = new Date();
        if (!this.accountApplication.cdiPercent) this.accountApplication.cdiPercent = 1.0;

        this.accountApplicationFormGroup.get('accountIdFormControl')?.setValue(this.accountApplication.accountId || '');
        this.accountApplicationFormGroup.get('amountAppliedFormControl')?.setValue(this.accountApplication.amountApplied || '');
        this.accountApplicationFormGroup.get('maximumAmountFormControl')?.setValue(this.accountApplication.maximumAmount ?? '');
        this.accountApplicationFormGroup.get('cdiPercentFormControl')?.setValue(this.accountApplication.cdiPercent || '');
        this.accountApplicationFormGroup.get('fixedRateFormControl')?.setValue(this.accountApplication.fixedRate || '');
        this.accountApplicationFormGroup.get('maturityDateFormControl')?.setValue(this.accountApplication.maturityDate || '');
    }

    ngAfterViewInit(): void {
        this.currentDateChanged(this.accountApplication.dateApplied);
    }

    currentDateChanged(date: Date): void {
        this.accountApplication.dateApplied = date;
    }

    setTitle(): string {
        return this.accountApplication.editing ? 'Editar aplicação' : 'Nova aplicação';
    }

    cancel(): void {
        this.dialogRef.close();
    }

    save(): void {
        if (this.accountApplicationFormGroup.invalid) {
            this.accountApplicationFormGroup.markAllAsTouched();
            return;
        }
        if (this.datepickerinput?.date?.value?._d) this.accountApplication.dateApplied = this.datepickerinput.date.value._d;

        this.accountApplication.accountId = Number(this.accountApplication.accountId);
        this.accountApplication.amountApplied = Number(this.accountApplication.amountApplied);
        const maximumAmountRaw: any = this.accountApplicationFormGroup.get('maximumAmountFormControl')?.value;
        const maximumAmount = Number(maximumAmountRaw);
        this.accountApplication.maximumAmount = maximumAmountRaw === '' || maximumAmountRaw === null || maximumAmountRaw === undefined || !Number.isFinite(maximumAmount)
            ? null
            : maximumAmount;
        this.accountApplication.cdiPercent = Number(this.accountApplication.cdiPercent);

        if (this.accountApplication.fixedRate === null || this.accountApplication.fixedRate === undefined || this.accountApplication.fixedRate == 0) {
            this.accountApplication.fixedRate = null as any;
        } else {
            this.accountApplication.fixedRate = Number(this.accountApplication.fixedRate);
        }

        this.dialogRef.close(this.accountApplication);
    }

    delete(): void {
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            width: '420px',
            panelClass: localStorage.getItem('budgetLayout') === 'modern'
                ? 'modern-confirm-dialog-panel'
                : undefined,
            data: <ConfirmDialogData>{
                title: 'Desabilitar aplicação',
                message: `Deseja desabilitar esta aplicação?\n\nEla deixará de participar dos cálculos e relatórios, mas seu histórico continuará armazenado.`,
                confirmText: 'Desabilitar',
                cancelText: 'Cancelar',
            },
        });

        dialogRef.afterClosed().subscribe((confirmed) => {
            if (confirmed) {
                this.accountApplication.deleting = true;

                this.dialogRef.close(this.accountApplication);
            }
        });
    }
}
