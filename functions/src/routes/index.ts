import { RequestHandler, Router } from 'express';
import { AppState, renderHelper } from '../common.js';
import type { Chat } from '../types/documentSchemas.js';
import { validateNewChatForm } from '../types/validation.js';

const router = Router();
const appState = AppState.get();

router.param('chat_id', async (req, res, next, chat_id) => {
  if (typeof chat_id !== 'string') {
    throw new TypeError('chat_id param must be a string');
  }
  const docSnap = await appState.db.collection('rooms').doc(chat_id).get();
  if (docSnap.exists) {
    req.chat = docSnap.data() as Chat;
  } else {
    req.chat = undefined;
  }
  next();
});

router.get('/', async function(req, res, next) {
  const dbPresent = appState.getDBNoThrow() !== undefined;
  const sessionId = req.session?.id;
  res.render('index', { title: 'Express', dbPresent, sessionId });
} satisfies RequestHandler);

router.route('/chat/new')
  .get((req, res, next) => {
    renderHelper(res, 'room/new', 'Create new chat', {}, {headExtension: 'room/head_chat'});
  })
  .post(async (req, res, next) => {
    const userId = req.session?.id;
    if (typeof userId !== 'string') {
      throw TypeError
    }
    const formData = req.body;
    console.log(formData);
    const [name, access] = validateNewChatForm(formData);
    const chat: Chat = {
      id: await appState.generateRoomId(),
      name,
      access,
      admin_id: userId
    }
    console.log('chat:', chat);
    const docSnap = await appState.db.collection('rooms').doc(chat.id).set(chat);
    res.redirect(`/chat/${chat.id}`);
  });
router.route('/chat/:chat_id')
  .get((req, res, next) => {
    const chat = req.chat;
    if (chat === undefined) {
      renderHelper(res, 'room/404', 'Chat not found', {}, {headExtension: 'room/head_chat'});
    } else {
      renderHelper(res, 'room/chat', `Chat ${chat.name}`, {chat}, {headExtension: 'room/head_chat'});
    }
  });

export default router;
