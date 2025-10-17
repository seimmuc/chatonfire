import type { Chat } from "./documentSchemas.js";

declare global {
  namespace Express {
    export interface Request {
      userId: string;
      chat?: Chat;
    }
  }
  namespace CookieSessionInterfaces {
    interface CookieSessionObject {
      id: string;
      lh: number;
    }
  }
}
