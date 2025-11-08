import { RequestHandler, Router } from 'express';
import { AppState, renderHelper } from '../common.js';
import { validateNewChatForm } from '../types/validation.js';
import { chatIdParamHandler, createNewChat, getRecentMessages, getSettings } from '../db.js';
import type { UserSettings } from '../types/documentSchemas.js';

const router = Router();
const appState = AppState.get();

router.param('chat_id', chatIdParamHandler);

router.get('/', async function(req, res, _next) {
  const dbPresent = appState.getDBNoThrow() !== undefined;
  const sessionId = req.session?.id;
  res.render('index', { title: 'Express', dbPresent, sessionId });
} satisfies RequestHandler);

router.route('/chat/new')
  .get((_req, res, _next) => {
    renderHelper(res, 'room/new', 'Create new chat', {}, {jsRequired: true, scripts: [{path: '/js/chatnew.mjs', module: true}]});
  });
router.route('/chat/:chat_id')
  .get(async (req, res, _next) => {
    const chat = req.chat;
    if (chat === undefined) {
      renderHelper(res, 'room/404', 'Chat not found', {}, {headExtension: {template: 'room/head_chat'}});
    } else {
      const messages = await getRecentMessages(chat.id, {message_count: 50});
      renderHelper(res, 'room/chat', `Chat ${chat.name}`, {chat, messages}, {headExtension: {template: 'room/head_chat'},
          jsRequired: true, scripts: [{path: '/js/chatview.mjs', module: true}]});
    }
  });

router.get('/settings', async (req, res, _next) => {
  const settings: UserSettings = (await getSettings(req.userId)) ?? {username: ''};
  renderHelper(res, 'settings', 'Settings', {settings}, {jsRequired: true, scripts: [{path: '/js/settings.mjs', module: true}]});
});

export default router;
