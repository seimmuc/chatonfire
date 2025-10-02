import { type RequestHandler } from "express";
import { v4 as UUIDv4 } from "uuid";

const sessionId: RequestHandler = (req, _res, next) => {
  const s = req.session;
  if (s === null || s === undefined) {
    throw new Error('no cookie session present, make sure that cookie-session middleware runs prior to session-id');
  }
  const sessionId = s.id;
  const sessionHour = s.lh;
  const curHour = Math.floor(Date.now() / 3600000);
  if (sessionId === undefined || sessionHour === undefined || sessionHour < curHour) {
    if (sessionId === undefined) {
      s.id = UUIDv4();
    }
    s.lh = curHour;
  }
  next();
};

export default () => sessionId;
