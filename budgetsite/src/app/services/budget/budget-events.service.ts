import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { CardsPostings } from 'src/app/models/cardspostings.model';

@Injectable({ providedIn: 'root' })
export class BudgetEventsService {
  private cardPostingCreated$ = new Subject<CardsPostings>();

  emitCardPostingCreated(posting: CardsPostings) {
    this.cardPostingCreated$.next(posting);
  }

  onCardPostingCreated(): Observable<CardsPostings> {
    return this.cardPostingCreated$.asObservable();
  }
}
