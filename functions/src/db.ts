import { RequestParamHandler } from "express";
import type { Chat, DBMessage, Message, NewMessage } from "./types/documentSchemas.js";
import { AppState } from "./common.js";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { GetMessagesRequest, NewChatRequest, NewMessageRequest } from "./types/apiTypes.js";

const appState = AppState.get();


function messageFromDb(message: DBMessage): Message {
  return {...message, timestamp: message.timestamp.toMillis()};
}


export async function getChatById(chatId: string): Promise<Chat | undefined> {
  const docSnap = await appState.db.collection('rooms').doc(chatId).get();
  if (docSnap.exists) {
    return docSnap.data() as Chat;
  } else {
    return undefined;
  }
}

export async function createNewChat(adminId: string, ncReq: NewChatRequest): Promise<Chat> {
  const chat: Chat = {id: appState.generateRoomId(), name: ncReq.name, access: ncReq.access, admin_id: adminId, whitelist: []};
  await appState.db.collection('rooms').doc(chat.id).set(chat);
  return chat;
}

export async function getRecentMessages(chatId: string, gmReq: GetMessagesRequest): Promise<Message[]> {
  let qry = appState.db.collection('rooms').doc(chatId).collection('messages').orderBy('timestamp', 'asc');
  if (gmReq.prior_to !== undefined) {
    qry = qry.endBefore(Timestamp.fromMillis(gmReq.prior_to));
  }
  const res = await qry.limitToLast(gmReq.message_count).get();
  console.debug(`received ${res.size} docs`);
  for (const doc of res.docs) {
    console.debug(doc.data());
  }
  return res.docs.map(doc => messageFromDb(doc.data() as DBMessage));
}

export async function createNewMessage(chatId: string, author: string, nmReq: NewMessageRequest): Promise<Message> {
  const message: NewMessage = {id: appState.generateMessageId(), author, content: nmReq.content};
  const res = await appState.db.collection('rooms').doc(chatId).collection('messages').doc(message.id).set({...message, timestamp: FieldValue.serverTimestamp()});
  return {...message, timestamp: res.writeTime.toMillis()};
}


export const chatIdParamHandler: RequestParamHandler = async (req, _res, next, chat_id) => {
  if (typeof chat_id !== 'string') {
    throw new TypeError('chat_id param must be a string');
  }
  req.chat = await getChatById(chat_id);
  next();
}
