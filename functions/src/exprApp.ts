import fullConfig from 'config';
import createError from 'http-errors';
import express, { json, urlencoded, static as exprStatic, ErrorRequestHandler, Express } from 'express';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import cookieSession from 'cookie-session';
import logger from 'morgan';

import sessionid from './middleware/sessionid.js';
import indexRouter from './routes/index.js';
import usersRouter from './routes/users.js';

const config = fullConfig.get('express');

const app = express();

// view engine setup
app.set('views', join(__dirname, 'views'));
app.set('view engine', 'ejs');

// set reverse proxy setting
// More info: https://expressjs.com/en/guide/behind-proxies.html
app.set('trust proxy', config.trustproxy);

app.use(logger('dev'));
app.use(json());
app.use(urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cookieSession({
  name: 'session',
  secret: config.cookiesession.secret,
  maxAge: config.cookiesession.maxage
}));
app.use(sessionid());

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'dev' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
} satisfies ErrorRequestHandler);

let staticApp: Express | undefined = undefined;
if (config.staticfiles) {
  staticApp = express();
  staticApp.use(exprStatic(join(__dirname, 'public')));
}

export {app, staticApp};
