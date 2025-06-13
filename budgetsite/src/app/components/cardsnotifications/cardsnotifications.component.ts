import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CardPostingsDialog } from '../cardpostings/cardpostings-dialog';
import moment from 'moment';
import { CardPostingsService } from 'src/app/services/cardpostings/cardpostings.service';
import { People } from 'src/app/models/people.model';
import { Categories } from 'src/app/models/categories.model';
import { Cards } from 'src/app/models/cards.model';
import { CardsPostings } from 'src/app/models/cardspostings.model';

@Component({
  selector: 'app-cards-notifications',
  templateUrl: './cardsnotifications.component.html',
  styleUrls: ['./cardsnotifications.component.scss'],
})
export class CardsNotificationsComponent {
  @Input() cardId?: number;
  @Input() reference?: string;
  @Input() peopleList?: People[];
  @Input() categoriesList?: Categories[];
  @Input() cardsList?: Cards[];

  @Output() peopleListChange = new EventEmitter<People[]>();
  @Output() categoriesListChange = new EventEmitter<Categories[]>();

  notifications = [
    {
      description: 'DUKAS GAS',
      note: 'R$ 45,98 - 11/06/2025 18:20 - DUKAS GAS',
      amount: 45.98,
      date: new Date('2025-06-11T18:20:00'),
    },
    {
      description: 'POSTO 7 MAIO',
      note: 'R$ 100,00 - 11/06/2025 14:26 - POSTO 7 MAIO',
      amount: 100,
      date: new Date('2025-06-11T14:26:00'),
    },
  ] as CardsPostings[];

  constructor(
    private dialog: MatDialog,
    private cardPostingsService: CardPostingsService
  ) {}

  convertToCardPosting(notification: CardsPostings): void {
    const dialogRef = this.dialog.open(CardPostingsDialog, {
      width: '100%',
      maxWidth: '100%',
      data: {
        reference: this.reference,
        cardId: this.cardId,
        date: notification.date,
        description: notification.description,
        amount: notification.amount,
        totalAmount: notification.amount,
        parcels: 1,
        parcelNumber: 1,
        peopleList: this.peopleList,
        categoriesList: this.categoriesList,
        cardsList: this.cardsList,
        editing: false,
        adding: true,
        note: notification.note,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        //this.hideProgress = false;

        Date.prototype.toJSON = function () {
          return moment(this).format('YYYY-MM-DDThh:mm:00.000Z');
        };

        this.cardPostingsService.create(result).subscribe({
          next: (cardpostings) => {
            this.notifications = this.notifications.filter(
              (n) => n !== notification
            );

            this.categoriesList = result.categoriesList;
            this.peopleList = result.peopleList;

            this.categoriesListChange.emit(this.categoriesList);
            this.peopleListChange.emit(this.peopleList);
          },
        });
      }
    });
  }
}
