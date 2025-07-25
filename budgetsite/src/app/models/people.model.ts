export interface People {
	id: number;
	name: string;
	color?: string;
  phoneNumber?: string;
	editing?: boolean;
	deleting?: boolean;
  canDelete?: boolean;
}
