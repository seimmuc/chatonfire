import { Router } from "express";
import { chatIdParamHandler, createNewChat, getRecentMessages, createNewMessage } from "../db.js";
import { validateGetMessageRequest, validateNewChatRequest, validateNewMessageRequest } from "../types/validation.js";
import { GetMessagesError, GetMessagesResponse, NewChatResponse, NewMessageError, NewMessageResponse } from "../types/apiTypes.js";

const router = Router();

router.param('chat_id', chatIdParamHandler);


router.post('/chat/newchat', async (req, res, _next) => {
  const data = await validateNewChatRequest(req.body);
  const chat = await createNewChat(req.userId, data);
  res.status(200).json({
    status: 200,
    chat_id: chat.id,
    chat_url_path: `/chat/${chat.id}`
  } satisfies NewChatResponse);
});

router.post('/chat/:chat_id/newmessage', async (req, res, _next) => {
  const msgRequest = await validateNewMessageRequest(req.body);
  const chat = req.chat;
  if (chat === undefined) {
    res.status(404).json({
      status: 404,
      error: 'chat_not_found',
      error_message: 'chat not found'
    } satisfies NewMessageError);
  } else {
    await createNewMessage(chat.id, req.userId, msgRequest);
    res.status(200).json({
      status: 200
    } satisfies NewMessageResponse);
  }
});

router.get('/chat/:chat_id/messages', async (req, res, _next) => {
  const data = await validateGetMessageRequest(req.query);
  const chat = req.chat;
  if (chat === undefined) {
    res.status(404).json({
      status: 404,
      error: 'chat_not_found',
      error_message: 'chat not found'
    } satisfies GetMessagesError);
  } else {
    console.log(data);
    const messages = await getRecentMessages(chat.id, data);
    res.status(200).json({status: 200, messages} satisfies GetMessagesResponse);
  }
});

export default router;
