import { RequestHandler, Router } from 'express';
import { AppState } from '../common.js';
const router = Router();

const appState = AppState.get();

/* GET home page. */
router.get('/', function(req, res, next) {
  const dbPresent = appState.getDBNoThrow() !== undefined;
  res.render('index', { title: 'Express', dbPresent });
} satisfies RequestHandler);

export default router;
