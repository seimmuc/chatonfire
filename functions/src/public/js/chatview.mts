import type { Message, NewMessageRequest } from '../../types/apiTypes.js';

type CIE = {
  form: HTMLFormElement;
  textField: HTMLInputElement;
  sendButton: HTMLButtonElement;
}
type ChatInputElems = CIE & {complete: true} | Partial<CIE> & {complete: false};
type ChatMessageElems = {
  root: HTMLDivElement;
  time: HTMLSpanElement;
  author: HTMLSpanElement;
  content: HTMLSpanElement;
}
type MessageAddMode = 'earliest' | 'lastest';

declare global {
  // HTML-embeded JSON data
  const initChatDataJson: string;
}

class ChatMessage {
  data: Message;
  elements: ChatMessageElems;
  private static createElements(): ChatMessageElems {
    const root = document.createElement('div');
    root.classList.add('message');
    const time = document.createElement('span');
    time.classList.add('timestamp');
    root.appendChild(time);
    const author = document.createElement('span');
    author.classList.add('author', 'empty');
    root.appendChild(author);
    const content = document.createElement('span');
    content.classList.add('content');
    root.appendChild(content);
    return {root, time, author, content};
  }
  constructor(apiMessage: Message) {
    this.data = apiMessage;
    this.elements = ChatMessage.createElements();
    this.elements.time.textContent = new Date(apiMessage.timestamp).toLocaleTimeString();
    this.elements.content.textContent = apiMessage.content;
  }
  updateAuthor(authorsCache: Record<string, string>): boolean {
    if (this.data.author in authorsCache) {
      this.elements.author.textContent = authorsCache[this.data.author];
      this.elements.author.classList.remove('empty');
      return true;
    } else {
      this.elements.author.textContent = '';
      this.elements.author.classList.add('empty');
      return false;
    }
  }
}

class ChatHistory {
  allMessages: Record<string, ChatMessage> = {};
  usernameCache: Record<string, string> = {};
  missingAuthorName: Set<string> = new Set();
  rootElement: HTMLDivElement;
  constructor(msgBoxElem: HTMLDivElement) {
    this.rootElement = msgBoxElem;
  }
  addMessage(msg: Message, mode: MessageAddMode = 'lastest') {
    if (!(msg.id in this.allMessages)) {
      const cm = new ChatMessage(msg);
      if (!cm.updateAuthor(this.usernameCache)) {
        this.missingAuthorName.add(msg.id);
      }
      if (mode === 'lastest') {
        this.rootElement.append(cm.elements.root);
      } else {
        this.rootElement.prepend(cm.elements.root);
      }
      this.allMessages[msg.id] = cm;
    }
  }
  addMessages(messages: Message[], mode: MessageAddMode) {
    for (const message of messages) {
      this.addMessage(message, mode);
    }
  }
  addUsernames(usernames: Record<string, string>, updateMissingOnly=true) {
    const cache = this.usernameCache;
    for (const [userId, username] of Object.entries(usernames)) {
      cache[userId] = username;
    }
    const updateMessages = updateMissingOnly ? Array.from(this.missingAuthorName.keys().map(mid => this.allMessages[mid])) : Object.values(this.allMessages);
    for (const msg of updateMessages) {
      if (msg.updateAuthor(cache)) {
        this.missingAuthorName.delete(msg.data.id);
      }
    }
  }
}

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
}

function init() {
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
  const messageBox = chatbox.querySelector('div.messages') as HTMLDivElement | null;
  if (messageBox === null) {
    console.error('message box not found');
    return;
  }
  const ch = new ChatHistory(messageBox);
  const {messages, usernames} = JSON.parse(initChatDataJson) as {messages: Message[], usernames: Record<string, string>};
  ch.addUsernames(usernames);
  ch.addMessages(messages, 'lastest');
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
