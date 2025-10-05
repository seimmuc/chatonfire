import { ACCESS_MODE } from "./documentSchemas";

const CHAT_VISIBILITY: Record<string, ACCESS_MODE> = {'public': 'public', 'private': 'whitelist'};

export function validateNewChatForm(formData: object): [string, ACCESS_MODE] {
  if (typeof formData !== 'object') {
    throw new TypeError('new chat formData must be an object');
  }
  // TODO validate data using yup
  const data = formData as {'chat-name': string, 'chat-visibility': 'public' | 'private'};
  return [data['chat-name'], CHAT_VISIBILITY[data['chat-visibility']]];
}
