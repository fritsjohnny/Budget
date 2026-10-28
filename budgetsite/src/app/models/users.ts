export interface Users {
	id?: number;
	name: string;
	login: string;
	email?: string | null;
	emailVerified?: boolean;
	pendingEmail?: string | null;
	password?: string;
}
