import type { NewMessageRequest } from '../../types/apiTypes.js';

type CIE = {
  form: HTMLFormElement;
  textField: HTMLInputElement;
  sendButton: HTMLButtonElement;
}
type ChatInputElems = CIE & {complete: true} | Partial<CIE> & {complete: false};

function findInputElems(): ChatInputElems {
  let textField: HTMLInputElement | undefined = undefined;
  let sendButton: HTMLButtonElement | undefined = undefined;
  const form = document.querySelector('form#send-message-form') as HTMLFormElement ?? undefined;
  if (form !== undefined) {
    textField = form.querySelector('input#send-message-text') as HTMLInputElement | null ?? undefined;
    sendButton = form.querySelector('button#send-message-btn') as HTMLButtonElement | null ?? undefined;
  }
  if (form === undefined || textField === undefined || sendButton === undefined) {
    return {complete: false, form, textField, sendButton};
  }
  return {complete: true, form, textField, sendButton};
}

async function sendMessage(event: SubmitEvent, textField: HTMLInputElement, chatId: string) {
  event.preventDefault();
  const messageData: NewMessageRequest = {content: textField.value};
  const response = await fetch(`/api/chat/${chatId}/newmessage`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(messageData)
  });
  console.log(await response.json());
}

function init() {
  console.log('init');
  const chatbox = document.querySelector('div.chatbox') as HTMLElement | null;
  if (chatbox === null) {
    console.error('chatbox not found');
    return;
  }
  const chatId = chatbox.dataset.chatId;
  if (chatId === undefined) {
    console.error('missing chat id');
    return;
  }
  initChatInput(chatId);
}

function initChatInput(chatId: string) {
  const chatElems = findInputElems();
  if (!chatElems.complete) {
    console.error('chat input elements are missing:', Object.keys(chatElems).filter(k => (chatElems[k as keyof ChatInputElems] === undefined)).join(', '));
    return;
  }
  chatElems.textField.placeholder = 'message';
  chatElems.textField.disabled = false;
  chatElems.sendButton.removeAttribute('style');
  chatElems.sendButton.disabled = false;
  chatElems.form.addEventListener('submit', e => sendMessage(e, chatElems.textField, chatId));
}

if (document.readyState === 'loading') {
  document.addEventListener('readystatechange', init, {once: true});
} else {
  init();
}
