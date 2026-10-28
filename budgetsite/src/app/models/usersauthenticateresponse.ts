export interface UsersAuthenticateResponse {
	id?: number;
	name: string;
	login: string;
	email?: string | null;
	emailVerified?: boolean;
	token: string;
}
