import type { ACCESS_MODE } from "./documentSchemas.js";
import { GetMessagesRequest, NewChatRequest, NewMessageRequest } from "./apiTypes.js";

const CHAT_VISIBILITY: Record<string, ACCESS_MODE> = {'public': 'public', 'private': 'whitelist'};

export function validateNewChatForm(formData: object): NewChatRequest {
  if (typeof formData !== 'object') {
    throw new TypeError('new chat formData must be an object');
  }
  // TODO validate data using yup
  const data = formData as {'chat-name': string, 'chat-visibility': 'public' | 'private'};
  return {name: data['chat-name'], access: CHAT_VISIBILITY[data['chat-visibility']]};
}

export function validateNewChatRequest(data: any): NewChatRequest {
  return {name: data.name, access: data.access};
}

export function validateNewMessageRequest(data: any): NewMessageRequest {
  return {content: data.content};
}

export function validateGetMessageRequest(data: any): GetMessagesRequest {
  return {message_count: parseInt(data.message_count), prior_to: data.prior_to ? parseInt(data.prior_to) : undefined};
}
