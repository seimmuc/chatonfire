/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import { getFirestore } from "firebase-admin/firestore";
// import * as logger from "firebase-functions/logger";
import eApp from './exprApp.js';
import { initializeApp } from "firebase-admin/app";
import { AppState } from "./common.js";

const state = AppState.get();

setGlobalOptions({maxInstances: 10});

const app = initializeApp();

const db = getFirestore(app);
state.db = db;

export const web = onRequest(eApp);
