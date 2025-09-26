import { RequestHandler, Router } from 'express';
var router = Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
} satisfies RequestHandler);

export default router;
