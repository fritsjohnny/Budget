import { environment } from '../../environments/environment';

export class ApiUrls {
  public static baseUrl = environment.baseUrl;

  public static accounts                 = ApiUrls.baseUrl + 'accounts';
  public static accounttotals            = ApiUrls.baseUrl + 'accounts/totals?';
  public static accountssummary          = ApiUrls.baseUrl + 'accounts/accountssummary?';
  public static totalsaccountssummary    = ApiUrls.baseUrl + 'accounts/summarytotals?';

  public static accountspostings         = ApiUrls.baseUrl + 'accountspostings';               // GET .../accountspostings/{accountId}/{reference}
  public static accountsyields           = ApiUrls.baseUrl + 'accountspostings/yields';        // GET .../accountspostings/yields/{reference}/{accountId}

  public static cards                    = ApiUrls.baseUrl + 'cards';
  public static cardspostings            = ApiUrls.baseUrl + 'cardspostings';
  public static cardspostingspeople      = ApiUrls.baseUrl + 'cardspostings/people?';
  public static cardsreceipts            = ApiUrls.baseUrl + 'cardsreceipts';
  public static expenses                 = ApiUrls.baseUrl + 'expenses';
  public static incomes                  = ApiUrls.baseUrl + 'incomes';
  public static people                   = ApiUrls.baseUrl + 'people';
  public static yield                    = ApiUrls.baseUrl + 'yields';
  public static budgetTotals             = ApiUrls.baseUrl + 'budget/totals?';
  public static categories               = ApiUrls.baseUrl + 'categories';
  public static users                    = ApiUrls.baseUrl + 'users';
  public static health                   = ApiUrls.baseUrl + 'health';
}
