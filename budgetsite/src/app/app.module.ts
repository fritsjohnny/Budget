import { NgModule, LOCALE_ID } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppComponent } from './app.component';

import { AppRoutingModule } from './app-routing.module';

import localePt from '@angular/common/locales/pt';
import { registerLocaleData } from '@angular/common';

import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { LayoutModule } from '@angular/cdk/layout';
import { DragDropModule, CDK_DRAG_CONFIG } from '@angular/cdk/drag-drop';

import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule } from '@angular/material/dialog';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSortModule } from '@angular/material/sort';

import { ClipboardModule } from 'ngx-clipboard';

import { NavComponent } from './components/template/nav/nav.component';
import { AccountViewComponent } from './views/account-view/account-view.component';
import { AccountComponent } from './components/account/account.component';
import { AccountDialog } from './components/account/account-dialog';
import { AccountPostingsComponent } from './components/accountpostings/accountpostings.component';
import { AccountPostingsDialog } from './components/accountpostings/accountpostings-dialog';
import { CardViewComponent } from './views/card-view/card-view.component';
import { CardComponent } from './components/card/card.component';
import { CardDialog } from './components/card/card-dialog';
import { CardPostingsComponent } from './components/cardpostings/cardpostings.component';
import { CardReceiptsDialog } from './components/cardpostings/cardreceipts-dialog';
import { CardPostingsDialog } from './components/cardpostings/cardpostings-dialog';
import { BudgetComponent } from './components/budget/budget.component';
import { PaymentReceiveDialog } from './components/budget/payment-receive-dialog';
import { IncomesDialog } from './components/budget/incomes-dialog';
import { ExpensesDialog } from './components/budget/expenses-dialog';
import { DatepickerComponent } from './shared/datepicker/datepicker.component';
import { BudgetViewComponent } from './views/budget-view/budget-view.component';
import { DatepickerinputComponent } from './shared/datepickerinput/datepickerinput.component';
import { SummaryComponent } from './components/summary/summary.component';
import { SummaryViewComponent } from './views/summary-view/summary-view.component';
import { CategoryComponent } from './components/category/category.component';
import { DatepickerreferenceComponent } from './shared/datepickerreference/datepickerreference.component';
import { PeopleComponent } from './components/people/people.component';
import { ReportViewComponent } from './views/report-view/report-view.component';
import { ReportComponent } from './components/report/report.component';

import { MAT_COLOR_FORMATS, NgxMatColorPickerModule, NGX_MAT_COLOR_FORMATS } from '@angular-material-components/color-picker';
import { AddvalueComponent } from './shared/addvalue/addvalue.component';
import { LoginViewComponent } from './views/login-view/login-view.component';
import { LoginComponent } from './components/login/login.component';
import { TokenInterceptor } from './services/interceptors/token.interceptor';
import { CurrencyMaskConfig, CurrencyMaskModule, CURRENCY_MASK_CONFIG } from 'ng2-currency-mask';
import { UserRegisterComponent } from './components/userregister/userregister.component';
import { UserComponent } from './components/user/user.component';
import { UserRegisterViewComponent } from './views/userregister-view/userregister-view.component';
import { FixedExpensesReportComponent } from './components/reports/fixed-expenses-report/fixed-expenses-report.component';
import { ThirdPartyExpensesReportComponent } from './components/reports/third-party-expenses-report/third-party-expenses-report.component';
import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog.component';
import { BottomTabsComponent } from './shared/bottom-tabs/bottom-tabs.component';
import { RouteReuseStrategy } from '@angular/router';
import { CustomReuseStrategy } from './core/strategies/custom-reuse-strategy';
import { CardsNotificationsComponent } from './components/cardsnotifications/cardsnotifications.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { DragReadyFeedbackDirective } from './directives/drag-ready-feedback.directive';
import { YieldsComponent } from './components/yields/yields.component';

export const CustomCurrencyMaskConfig: CurrencyMaskConfig = {
  align: "right",
  allowNegative: true,
  decimal: ",",
  precision: 2,
  prefix: "R$ ",
  suffix: "",
  thousands: "."
};

registerLocaleData(localePt);

@NgModule({
  declarations: [
    AppComponent,
    NavComponent,
    AccountComponent,
    AccountDialog,
    AccountPostingsComponent,
    CardComponent,
    CardDialog,
    AccountViewComponent,
    CardViewComponent,
    CardPostingsComponent,
    BudgetComponent,
    DatepickerComponent,
    BudgetViewComponent,
    CardPostingsDialog,
    CardReceiptsDialog,
    AccountPostingsDialog,
    ExpensesDialog,
    PaymentReceiveDialog,
    IncomesDialog,
    DatepickerinputComponent,
    SummaryComponent,
    SummaryViewComponent,
    CategoryComponent,
    DatepickerreferenceComponent,
    PeopleComponent,
    AddvalueComponent,
    LoginViewComponent,
    LoginComponent,
    UserRegisterComponent,
    UserComponent,
    UserRegisterViewComponent,
    ReportViewComponent,
    ReportComponent,
    FixedExpensesReportComponent,
    ThirdPartyExpensesReportComponent,
    ConfirmDialogComponent,
    BottomTabsComponent,
    CardsNotificationsComponent,
    DragReadyFeedbackDirective,
    YieldsComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatSlideToggleModule,
    MatAutocompleteModule,

    // CDK
    LayoutModule,
    DragDropModule,

    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
    MatTableModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDividerModule,
    MatDialogModule,
    MatMomentDateModule,
    MatSelectModule,
    MatExpansionModule,
    MatRadioModule,
    MatCheckboxModule,
    MatMenuModule,
    MatSortModule,
    ClipboardModule,
    NgxMatColorPickerModule,
    CurrencyMaskModule,
    FontAwesomeModule,
  ],
  exports: [
    DragReadyFeedbackDirective
  ],
  providers: [
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    {
      provide: CDK_DRAG_CONFIG,
      useValue: {
        dragStartDelay: 1000,
        listOrientation: 'vertical'
      }
    },
    { provide: MAT_COLOR_FORMATS, useValue: NGX_MAT_COLOR_FORMATS },
    { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
    { provide: CURRENCY_MASK_CONFIG, useValue: CustomCurrencyMaskConfig },
    { provide: RouteReuseStrategy, useClass: CustomReuseStrategy }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
