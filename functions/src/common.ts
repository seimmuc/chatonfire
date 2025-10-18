import { Snowflake } from "@skorotkiewicz/snowflake-id";
import { Response } from "express";
import { Firestore } from "firebase-admin/firestore";


// AppState

export class AppState {
  private static SINGLETON: AppState | undefined = undefined;

  public static get(): AppState {
    if (this.SINGLETON === undefined) {
      this.SINGLETON = new AppState();
    }
    return this.SINGLETON;
  }

  private constructor() {
    // Sadly Firebase Functions does not allow us to get instance id, so the next best thing is to generate a random id and just hope that there's no collision
    // TODO come up with a better solution
    const machineId = Math.floor(Math.random() * 1024);
    this.roomSnowflake = new Snowflake(machineId);
    this.messageSnowflake = new Snowflake(machineId);
  }

  private _db?: Firestore;
  private roomSnowflake: Snowflake;
  private messageSnowflake: Snowflake;

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
  
  public async generateRoomId(): Promise<string> {
    return snowflakeIdToBase64(await this.roomSnowflake.generate());
  }
  public async generateMessageId(): Promise<string> {
    return snowflakeIdToBase64(await this.messageSnowflake.generate());
  }
}


// Snowflake IDs

const MAX_U64INT = 2n ** 64n - 1n;

function snowflakeIdToBase64(snowflakeId: string): string {
  const num = BigInt(snowflakeId);
  if (num > MAX_U64INT) {
    throw new TypeError('provided snowflake id is too large');
  }
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(num, 0);
  return buf.toString('base64').replace(/={1,2}$/, '');
}


// Other

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

type RenderOptions = {
  headExtension?: {template: string, data?: object};
  jsRequired?: boolean;
  scripts?: {path: string, module?: boolean}[];
}
export function renderHelper(res: Response, viewPath: string, pageTitle: string, viewData: Record<string, any>, options?: RenderOptions) {
  res.render('page.ejs', {
    contentPath: viewPath,
    contentData: viewData,
    title: pageTitle,
    scripts: options?.scripts,
    headExtension: options?.headExtension,
    jsRequired: options?.jsRequired ?? false
  });
}
