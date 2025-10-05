export type ACCESS_MODE = 'public' | 'whitelist';

export interface Chat {
  id: string;
  name: string;
  admin_id: string;
  access: ACCESS_MODE;
}
