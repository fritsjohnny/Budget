import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { Messenger } from 'src/app/common/messenger';
import { People } from 'src/app/models/people.model';
import { PeopleService } from 'src/app/services/people/people.service';
import { ConfirmDialogComponent, ConfirmDialogData } from 'src/app/shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-people',
  templateUrl: './people.component.html',
  styleUrls: ['./people.component.scss']
})
export class PeopleComponent implements OnInit {
  people!: People;

  peopleFormGroup = new FormGroup(
    {
      nameFormControl: new FormControl('', Validators.required),
      phoneFormControl: new FormControl('', [Validators.pattern(/^\+?\d{10,15}$/)]),
    });

  constructor(
    public dialogRef: MatDialogRef<PeopleComponent>,
    @Inject(MAT_DIALOG_DATA) public data: People,
    private peopleService: PeopleService,
    private messenger: Messenger,
    private dialog: MatDialog,
  ) { }

  ngOnInit(): void {
    this.people = {
      id: this.data?.id,
      name: this.data?.name ?? '',
      phoneNumber: this.data?.phoneNumber ?? '',
      editing: this.data?.editing ?? false,
      canDelete: this.data?.canDelete != undefined ? this.data?.canDelete : true,
    };

    // Sincroniza o FormGroup com os valores iniciais
    this.peopleFormGroup.patchValue({
      nameFormControl: this.people.name,
      phoneFormControl: this.people.phoneNumber,
    });
  }

  setTitle() {

    return 'Pessoa - ' + (this.people.editing ? 'Editar' : 'Incluir');
  }

  cancel(): void {

    this.dialogRef.close();
  }

  save(): void {
    // Atualiza campos
    this.people.name = this.peopleFormGroup.get('nameFormControl')?.value ?? '';
    this.people.phoneNumber = this.peopleFormGroup.get('phoneFormControl')?.value ?? '';

    const action = this.people.editing
      ? this.peopleService.update(this.people)
      : this.peopleService.create(this.people);

    action.subscribe({
      next: (updated) => {
        this.dialogRef.close(updated); // ✅ retorna o objeto real, atualizado do back-end
      },
      error: (err) => {
        this.messenger.errorHandler(err);
      }
    });
  }

  delete(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: <ConfirmDialogData>{
        title: 'Excluir Pessoa',
        message: 'Confirma a EXCLUSÃO da pessoa?',
        confirmText: 'Sim',
        cancelText: 'Cancelar',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.peopleService.delete(this.people.id).subscribe({
          next: () => {
            this.people.deleting = true;
            this.dialogRef.close(this.people);
          },
          error: (err) => {
            this.messenger.errorHandler(err);
            this.people.deleting = false;
          }
        });
      }
    });
  }
}
