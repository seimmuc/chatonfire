import type { Chat } from "./documentSchemas.js";

declare global {
  namespace Express {
    export interface Request {
      chat?: Chat;
    }
  }
}
