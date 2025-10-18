import { Timestamp } from "firebase-admin/firestore";

export type ACCESS_MODE = 'public' | 'whitelist';

export interface Chat {
  id: string;
  name: string;
  access: ACCESS_MODE;
  admin_id: string;
  whitelist: string[];
}

export interface Message {
  id: string;
  timestamp: number;
  author: string;
  content: string;
}
export type NewMessage = Omit<Message, 'timestamp'>;
export type DBMessage = Omit<Message, 'timestamp'> & {timestamp: Timestamp};
