import { type Chat } from "./documentSchemas";

declare global {
  namespace Express {
    export interface Request {
      chat?: Chat;
    }
  }
}
