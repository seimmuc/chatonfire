import { RequestHandler, Router } from 'express';
import { AppState, renderHelper } from '../common.js';
import { validateNewChatForm } from '../types/validation.js';
import { chatIdParamHandler, createNewChat, getRecentMessages } from '../db.js';

const router = Router();
const appState = AppState.get();

router.param('chat_id', chatIdParamHandler);

router.get('/', async function(req, res, _next) {
  const dbPresent = appState.getDBNoThrow() !== undefined;
  const sessionId = req.session?.id;
  res.render('index', { title: 'Express', dbPresent, sessionId });
} satisfies RequestHandler);

router.route('/chat/new')
  .get((req, res, _next) => {
    renderHelper(res, 'room/new', 'Create new chat', {}, {headExtension: 'room/head_chat'});
  })
  .post(async (req, res, _next) => {
    const userId = req.session?.id;
    if (typeof userId !== 'string') {
      throw TypeError
    }
    const formData = req.body;
    console.log(formData);
    const requestData = validateNewChatForm(formData);
    const chat = await createNewChat(userId, requestData);
    res.redirect(`/chat/${chat.id}`);
  });
router.route('/chat/:chat_id')
  .get(async (req, res, _next) => {
    const chat = req.chat;
    if (chat === undefined) {
      renderHelper(res, 'room/404', 'Chat not found', {}, {headExtension: 'room/head_chat'});
    } else {
      const messages = await getRecentMessages(chat.id, {message_count: 50});
      renderHelper(res, 'room/chat', `Chat ${chat.name}`, {chat, messages}, {headExtension: 'room/head_chat', jsRequired: true});
    }
  });

export default router;
