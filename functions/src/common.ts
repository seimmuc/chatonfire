import { Firestore } from "firebase-admin/firestore";

export class AppState {
  private static SINGLETON: AppState | undefined = undefined;

  public static get(): AppState {
    if (this.SINGLETON === undefined) {
      this.SINGLETON = new AppState();
    }
    return this.SINGLETON;
  }

  private constructor() {}

  private _db?: Firestore;

  public get db(): Firestore {
    if (this._db === undefined) {
      throw new Error('no db');
    }
    return this._db;
  }
  public set db(firestoreDB: Firestore | undefined) {
    this._db = firestoreDB;
  }
  public getDBNoThrow(): Firestore | undefined {
    return this._db;
  }
}
