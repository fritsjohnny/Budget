import { ChangeDetectorRef, Component, OnInit, AfterViewInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Cards } from 'src/app/models/cards.model';
import { CardService } from 'src/app/services/card/card.service';
import { CardDialog } from './card-dialog';
import { NotificationReader } from 'capacitor-notification-reader/src';
import { Messenger } from 'src/app/common/messenger';
import { delay, retryWhen, tap } from 'rxjs';

@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.scss']
})
export class CardComponent implements OnInit, AfterViewInit {

  cards?: Cards[];
  totalBalance?: number;
  previousBalance?: number;
  totalYields?: number;
  cardId?: number;
  reference?: string;
  referenceHead?: string;
  card!: Cards;
  hideProgress: boolean = false;
  buttonName: string = "";

  constructor(private cardService: CardService,
    private cd: ChangeDetectorRef,
    public dialog: MatDialog,
    private messenger: Messenger
  ) {

    this.cardId = Number(localStorage.getItem("cardId"));
  }

  ngAfterViewInit(): void {

    this.cd.detectChanges();
  }

  ngOnInit(): void {
    this.refresh();
  }

  refresh() {
    this.hideProgress = false;

    this.cardService.read().pipe(
      retryWhen(errors =>
        errors.pipe(
          tap((err) => console.warn('🔁 Erro ao carregar cartões. Tentando novamente em 10 segundos...', err)),
          delay(10000)
        )
      )
    ).subscribe({
      next: (cards) => {
        this.cards = cards;

        this.cards.forEach(card => {
          if (card.id === this.cardId) {
            this.setCard(card);
          }
        });

        this.hideProgress = true;
      },
      error: (err) => {
        console.error('Erro irrecuperável ao carregar cartões:', err);
        this.cards = [];
        this.hideProgress = true;
      }
    });
  }

  setReference(reference: string) {

    this.reference = reference;

    this.referenceHead = this.reference.substr(4, 2) + "/" + this.reference.substr(0, 4);
  }

  setCard(card: Cards) {

    if (card) {

      this.buttonName = card.name;
      this.hideProgress = false;

      this.cardId = card.id;
      this.card = card;

      localStorage.setItem("cardId", card.id!.toString());
    }

    this.hideProgress = true;
  }

  getCardsNotDisabled(cards: Cards[]) {

    return cards?.filter(card => card.disabled == null || card.disabled == false);
  }

  cardDialog() {
    const dialogRef = this.dialog.open(CardDialog, {
      width: '100%',
      maxWidth: '100%',
      data: this.cards
    });

    dialogRef.afterClosed().subscribe(result => {

      if (result) {

        this.hideProgress = false;

        if (result.deleting) {

          this.cardService.delete(result.id).subscribe(
            {
              next: () => {

                this.cards = this.cards!.filter(t => t.id! != result.id!);

                if (this.cards.length > 0) {

                  this.setCard(this.cards[0]);
                }
              },
              error: () => this.hideProgress = true
            }
          );
        }
        else if (result.editing) {

          this.cardService.update(result).subscribe(
            {
              next: () => {

                this.cards!.filter(t => t.id! === result.id!).map(t => {
                  t.id = result.id;
                  t.userId = result.userId;
                  t.name = result.name;
                  t.color = result.color;
                  t.background = result.background;
                  t.disabled = result.disabled;
                  t.closingDay = result.closingDay;
                  t.dueDay = result.dueDay;
                  t.appPackageName = result.appPackageName;
                });

                if (result.disabled && this.cards!.length > 0) {

                  this.setCard(this.cards![0]);
                }
                else {

                  this.setCard(result);
                }
              },
              error: () => this.hideProgress = true
            }
          );
        }
        else {

          this.cardService.create(result).subscribe(
            {
              next: card => {

                this.cards!.push(card);

                this.setCard(card);
              },
              error: () => this.hideProgress = true
            }
          );
        }
      }
    });
  }

  async openBankApp(): Promise<void> {
    if (!this.card?.appPackageName) {
      console.warn('Nenhum app de banco definido para este cartão.');
      return;
    }

    try {
      await NotificationReader.openApp({
        package: this.card.appPackageName,
      });
    } catch (err) {
      this.messenger.errorHandler(err);
      console.error('Erro ao abrir o app do cartão:', err);
    }
  }
}
