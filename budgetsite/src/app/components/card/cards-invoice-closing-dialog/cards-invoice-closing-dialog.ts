import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';
import { formatReference } from 'src/app/common/reference';
import { Messenger } from 'src/app/common/messenger';
import { CardsInvoiceClosing } from 'src/app/models/cardsinvoiceclosing.model';
import { CardsInvoiceClosingService } from 'src/app/services/cardsinvoiceclosing/cardsinvoiceclosing.service';

@Component({ selector: 'app-cards-invoice-closing-dialog', templateUrl: './cards-invoice-closing-dialog.html', styleUrls: ['./cards-invoice-closing-dialog.scss'] })
export class CardsInvoiceClosingDialog {
  saving = false;
  readonly formatReference = formatReference;
  constructor(@Inject(MAT_DIALOG_DATA) public closing: CardsInvoiceClosing,
    private dialogRef: MatDialogRef<CardsInvoiceClosingDialog>, private service: CardsInvoiceClosingService,
    private messenger: Messenger) {}
  cancel(): void { this.dialogRef.close(); }
  dateChanged(date: Date): void { this.closing.closingDate = date; }
  save(): void {
    if (!this.closing.closingDate || this.saving) return;
    this.saving = true;
    this.service.update(this.closing.id, this.closing.closingDate).pipe(finalize(() => this.saving = false)).subscribe({
      next: updated => { this.messenger.message('Data de fechamento salva com sucesso.'); this.dialogRef.close(updated); }
    });
  }
}
