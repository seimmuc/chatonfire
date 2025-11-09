import { Response } from "express";
import { Firestore } from "firebase-admin/firestore";
import Snowflakify, { RandomFragment, SequenceFragment, TimestampFragment, WorkerFragment } from "snowflakify";


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
    this.roomSnowflake = createSnowflakify();
    this.messageSnowflake = createSnowflakify();
  }

  private _db?: Firestore;
  private roomSnowflake: Snowflakify;
  private messageSnowflake: Snowflakify;

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
  
  public generateRoomId(): string {
    return snowflakeIdToBase64(this.roomSnowflake.nextId(), true);
  }
  public generateMessageId(): string {
    return snowflakeIdToBase64(this.messageSnowflake.nextId(), false);
  }
}


// Snowflake IDs

function createSnowflakify(): Snowflakify {
  // 126-bit id: timestamp-48, version-6, sequence-8, random-64
  // This results in 21-character base64 strings

  // Sadly Firebase Functions does not allow us to get worker/instance id, so we'll just create a large random number for each id and hope that there's no collision.
  // With 64 random bits, the odds of a collision between 2 IDs with the same timestamp and sequence portion are 1/2^64.
  // Given `n` workers generating `x` ids in the same millisecond, the odds of a collision are (LaTeX) $1-\left(\prod_{i=0}^{n - 1}\left(1-\frac{i}{2^{64}}\right)\right)^x$.
  // Assuming 200 workers generate 8 IDs per millisecond each, the probability of at least 1 collision per time period is:
  // 1 year: 0.027231%
  // 10 years: 0.271979%
  // 50 years: 1.352520%
  // 250 years: overly ambitious, but it's 6.582126%

  const version = 1;
  
  const tsFrag = new TimestampFragment(48, 0);
  // @ts-expect-error
  tsFrag.timeUnit = BigInt(10 ** 6);
  // @ts-expect-error
  tsFrag.epoch = 0n;
  return new Snowflakify({
    fragmentArray: [
      tsFrag,
      new WorkerFragment(6, version),
      new SequenceFragment(8),
      new RandomFragment(64)
    ]
  });
}

const MAX_U126INT = (1n << 126n) - 1n;
const MAX_U64INT = (1n << 64n) - 1n;
const MAX_U62INT = (1n << 62n) - 1n;
const buf = Buffer.alloc(16);

export function snowflakeIdToBase64(snowflakeId: bigint, scramble=false): string {
  if (snowflakeId > MAX_U126INT) {
    throw new TypeError('provided snowflake id is too large');
  }
  if (scramble) {
    for (let i = 0; i < 15; i++) {
      buf[i] = Number((snowflakeId >> BigInt(118 - i * 4)) & 0xc0n) | Number((snowflakeId >> BigInt(58 - i * 4)) & 0x3cn) | Number((snowflakeId >> BigInt(122 - i * 4)) & 0x03n);
    }
    buf[15] = Number((snowflakeId >> 58n) & 0xc0n) | Number((snowflakeId & 0x0fn) << 2n);
  } else {
    buf.writeBigUInt64BE((snowflakeId >> 62n) & MAX_U64INT, 0);
    buf.writeBigUInt64BE((snowflakeId & MAX_U62INT) << 2n, 8);
  }
  const b64 = buf.toString('base64url');  // no slashes and no padding
  if (b64.length !== 22 || b64[21] !== 'A') {
    throw new Error();
  }
  return b64.substring(0, 21);
}


// Other

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function batchItems<T>(items: Iterable<T>, batchSize: number): T[][] {
  if (batchSize < 1) {
    throw new RangeError(`batchSize must be >= 1, got ${batchSize}`);
  }
  const iter = items[Symbol.iterator]();
  batchSize = Math.floor(batchSize);
  const result: T[][] = [];
  for (let i = 0, bi = 0, it = iter.next(); !it.done; bi = Math.floor(++i / batchSize), it = iter.next()) {
    if (result.length === bi) {
      result.push([]);
    }
    result[bi].push(it.value);
  }
  return result;
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
