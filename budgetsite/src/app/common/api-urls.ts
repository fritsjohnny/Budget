export class ApiUrls {

    public static baseUrl: string = 'https://budgetapi-apim.azure-api.net/api/';
    // public static baseUrl: string = 'https://localhost:7194/api/';
    public static accounts: string = ApiUrls.baseUrl + 'accounts';
    public static accounttotals: string = ApiUrls.baseUrl + 'accounts/totals?';
    public static accountspostings: string = ApiUrls.baseUrl + 'accountspostings';
    public static cards: string = ApiUrls.baseUrl + 'cards';
    public static cardspostings: string = ApiUrls.baseUrl + 'cardspostings';
}