import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LoginViewComponent } from './views/login-view/login-view.component';
import { BudgetViewComponent } from './views/budget-view/budget-view.component';
import { AccountViewComponent } from './views/account-view/account-view.component';
import { CardViewComponent } from './views/card-view/card-view.component';
import { SummaryViewComponent } from './views/summary-view/summary-view.component';
import { NavComponent } from './components/template/nav/nav.component';
import { UnautheticatedUserGuard } from './services/guards/unautheticated-user.guard';
import { AutheticatedUserGuard } from './services/guards/autheticated-user.guard';
import { UserComponent } from './components/user/user.component';
import { UserRegisterViewComponent } from './views/userregister-view/userregister-view.component';
import { ReportViewComponent } from './views/report-view/report-view.component';

const routes: Routes = [
  {
    path: 'login',
    component: LoginViewComponent,
    canActivate: [UnautheticatedUserGuard],
  },
  {
    path: 'usersregister',
    component: UserRegisterViewComponent,
    canActivate: [UnautheticatedUserGuard],
  },
  {
    path: '',
    component: NavComponent,
    canActivate: [AutheticatedUserGuard],
    children: [
      {
        path: '',
        component: SummaryViewComponent,
      },
      {
        path: 'summary',
        component: SummaryViewComponent,
      },
      {
        path: 'budget',
        component: BudgetViewComponent,
      },
      {
        path: 'accounts',
        component: AccountViewComponent,
      },
      {
        path: 'cards',
        component: CardViewComponent,
      },
      {
        path: 'users',
        component: UserComponent,
      },

      {
        path: 'reports',
        component: ReportViewComponent,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
