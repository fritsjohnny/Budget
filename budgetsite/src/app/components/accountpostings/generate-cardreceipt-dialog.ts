import { Component, OnInit, Inject } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PeopleService } from 'src/app/services/people/people.service';
import { CardService } from 'src/app/services/card/card.service';

@Component({
    selector: 'generate-cardreceipt-dialog',
    templateUrl: 'generate-cardreceipt-dialog.html',
    styleUrls: ['generate-cardreceipt-dialog.scss'],
})
export class GenerateCardReceiptDialog implements OnInit {

    formGroup = new FormGroup({
        peopleIdFormControl: new FormControl('', Validators.required),
        cardIdFormControl: new FormControl('', Validators.required),

        // readonly
        dateFormControl: new FormControl(''),
        amountFormControl: new FormControl(''),
    });

    peopleList: any[] = [];
    cardsList: any[] = [];

    constructor(
        public dialogRef: MatDialogRef<GenerateCardReceiptDialog>,
        @Inject(MAT_DIALOG_DATA) public data: { peopleId?: number, cardId?: number, date?: Date, amount?: number, description?: string },
        private peopleService: PeopleService,
        private cardService: CardService
    ) { }

    ngOnInit(): void {
        if (this.data?.peopleId) this.formGroup.get('peopleIdFormControl')?.setValue(this.data.peopleId);
        if (this.data?.cardId) this.formGroup.get('cardIdFormControl')?.setValue(this.data.cardId);

        this.formGroup.get('dateFormControl')?.setValue(this.data?.date ?? null);
        this.formGroup.get('amountFormControl')?.setValue(this.data?.amount ?? 0);

        this.peopleService.read().subscribe({
            next: (people) => {
                this.peopleList = (people ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

                const current = this.formGroup.get('peopleIdFormControl')?.value;
                if (!current) {
                    const suggestedId = this.suggestPeopleIdFromDescription(this.data?.description, this.peopleList);
                    if (suggestedId) this.formGroup.get('peopleIdFormControl')?.setValue(suggestedId);
                }
            },
        });

        this.cardService.read().subscribe({
            next: (cards) => {
                this.cardsList = (cards ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

                const current = this.formGroup.get('cardIdFormControl')?.value;
                if (!current) {
                    const suggestedId = this.suggestCardIdFromDescription(this.data?.description, this.cardsList);
                    if (suggestedId) this.formGroup.get('cardIdFormControl')?.setValue(suggestedId);
                }
            },
        });
    }

    private suggestPeopleIdFromDescription(description: string | undefined, peopleList: any[]): number | null {
        if (!description) return null;

        const normalized = this.normalizeText(description);

        const ordered = (peopleList ?? [])
            .filter(p => !!p?.name)
            .sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0));

        for (const p of ordered) {
            const name = this.normalizeText(p.name);
            const regex = new RegExp(`(^|\\s|\\W)${this.escapeRegex(name)}($|\\s|\\W)`, 'i');
            if (regex.test(normalized)) return p.id;
        }

        return null;
    }

    private suggestCardIdFromDescription(description: string | undefined, cardsList: any[]): number | null {
        if (!description) return null;

        const normalized = this.normalizeText(description);

        const ordered = (cardsList ?? [])
            .filter(c => !!c?.name)
            .sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0));

        for (const c of ordered) {
            const name = this.normalizeText(c.name);
            const regex = new RegExp(`(^|\\s|\\W)${this.escapeRegex(name)}($|\\s|\\W)`, 'i');
            if (regex.test(normalized)) return c.id;
        }

        return null;
    }

    private normalizeText(text: string): string {
        return (text ?? '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    private escapeRegex(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    cancel(): void {
        this.dialogRef.close();
    }

    save(): void {
        if (!this.formGroup.valid) return;

        const peopleId = Number(this.formGroup.get('peopleIdFormControl')?.value);
        const cardId = Number(this.formGroup.get('cardIdFormControl')?.value);

        this.dialogRef.close({ peopleId, cardId });
    }

    setTitle(): string {
        return 'Gerar Recebimento Cartão';
    }
}