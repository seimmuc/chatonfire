import type { ACCESS_MODE, NewChatRequest, NewChatResponse, NewChatError } from '../../types/apiTypes.js';


const CHAT_VISIBILITY: Record<string, ACCESS_MODE> = {'public': 'public', 'private': 'whitelist'};
const ANIM_DELAY = 1000;


class ErrorMessageComponent {
  msgElem: HTMLDivElement;
  private timeouts: (NodeJS.Timeout | number)[] = [];
  constructor(msgElem: HTMLDivElement) {
    this.msgElem = msgElem;
  }
  private setError(message?: string, shown?: boolean) {
    const errElem = this.msgElem
    if (errElem === null) {
      return;
    }
    if (message !== undefined) {
      errElem.textContent = message;
    }
    if (shown !== undefined) {
      if (shown) {
        const gs = () => {
          errElem.classList.add('grow');
          errElem.classList.remove('shrink');
        }
        if (errElem.classList.contains('hidden')) {
          // We have to change display value BEFORE others for the animation to work
          errElem.classList.remove('hidden');
          this.timeouts.push(setTimeout(gs, 0))
        } else {
          gs();
        }
      } else {
        errElem.classList.add('shrink');
        errElem.classList.remove('grow');
        if (!errElem.classList.contains('hidden')) {
          this.timeouts.push(setTimeout(() => {
            errElem.classList.add('hidden');
          }, ANIM_DELAY));
        }
      }
    }
  }
  clearTimeouts() {
    this.timeouts.forEach(clearTimeout);
    this.timeouts = [];
  }
  showError(message: string, timeout: number = 5000) {
    this.clearTimeouts();
    this.setError(message, true);
    this.timeouts.push(setTimeout(this.setError.bind(this, undefined, false), timeout));
  }
}

type SuspensionDuration = number | 'permanent';
interface SuspensionEventDetail {
  type: 'start' | 'end';
  remainingDuration: SuspensionDuration | undefined;
}

class ErrorController extends EventTarget {
  errComponent: ErrorMessageComponent;
  private suspUntil: number | undefined | true;
  private suspEndTimeout: NodeJS.Timeout | number | undefined;
  constructor(errComponent: ErrorMessageComponent) {
    super();
    this.errComponent = errComponent;
  }
  public get suspended(): boolean {
    if (this.suspUntil === true) {
      return true;
    }
    if (this.suspUntil !== undefined) {
      if (Date.now() > this.suspUntil) {
        this.suspUntil = undefined;
      } else {
        return true;
      }
    }
    return false;
  }
  private onSuspUpdate(remainingDuration: number | undefined) {
    clearTimeout(this.suspEndTimeout);
    this.dispatchEvent(new CustomEvent('suspend', {detail: {type: 'start', remainingDuration} satisfies SuspensionEventDetail}));
    if (remainingDuration !== undefined) {
      this.suspEndTimeout = setTimeout(() => {
        this.unsuspend();
      }, remainingDuration);
    }
  }
  showError(message: string, timeout?: number) {
    return this.errComponent.showError(message, timeout);
  }
  suspend(duration: number | 'permanent') {
    if (duration === 'permanent') {
      if (this.suspUntil !== true) {
        this.suspUntil = true;
        this.onSuspUpdate(undefined);
      }
    } else if (this.suspUntil !== true) {
      const newHU = Math.round(Date.now() + duration);
      if (this.suspUntil === undefined || newHU > this.suspUntil) {
        this.suspUntil = newHU;
        this.onSuspUpdate(duration);
      }
    }
  }
  unsuspend() {
    clearTimeout(this.suspEndTimeout);
    this.suspUntil = undefined;
    this.dispatchEvent(new CustomEvent('unsuspend', {detail: {type: 'end', remainingDuration: undefined} satisfies SuspensionEventDetail}));
  }
  handleError(errorMessage?: string, messageTimeout?: number, suspendDuration?: number | 'permanent') {
    if (errorMessage !== undefined) {
      this.showError(errorMessage, messageTimeout);
    }
    if (suspendDuration) {
      this.suspend(suspendDuration);
    }
  }
}

function isNCRequestValid(ncReq: NewChatRequest): boolean {
  const nl = ncReq.name.trim().length;
  if (nl < 3 || nl > 50) {
    return false;
  }
  if (!['public', 'whitelist'].includes(ncReq.access)) {
    return false;
  }
  return true;
}

async function createNewChat(event: SubmitEvent, form: HTMLFormElement, ec: ErrorController) {
  event.preventDefault();
  if (ec.suspended) {
    return;
  }
  const formData = new FormData(form, event.submitter);
  const name = formData.get('chat-name');
  const visibility = formData.get('chat-visibility');
  if (typeof name !== 'string' || typeof visibility !== 'string' || !Object.hasOwn(CHAT_VISIBILITY, visibility)) {
    ec.suspend('permanent');
  }
  const access = CHAT_VISIBILITY[visibility as string];
  const ncReq: NewChatRequest = {name: name as string, access};
  if (!isNCRequestValid(ncReq)) {
    ec.handleError('Invalid input', 4000, 1500);
    return;
  }
  const res = await fetch('/api/chat/newchat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(ncReq)
  });
  const resJson: NewChatResponse | NewChatError = await res.json();
  if (resJson.status === 200) {
    const ncRes = (resJson as NewChatResponse);
    window.location.replace(ncRes.chat_url_path);
  } else {
    const ncErr = (resJson as NewChatError);
    ec.handleError(ncErr.error_message, undefined, 'permanent');
  }
}

function init() {
  const errDiv = document.querySelector('div#new-chat-error-msg') as HTMLDivElement | null;
  if (errDiv === null) {
    console.error('error message div not found');
    return;
  }
  const newChatForm = document.querySelector('form#new-chat-form') as HTMLFormElement | null;
  if (newChatForm === null) {
    console.error('new chat form not found');
    return;
  }
  const createBtn = document.querySelector('button#new-chat-create-btn') as HTMLButtonElement | null;
  if (createBtn === null) {
    console.error('new chat create button not found');
    return;
  }
  const ec = new ErrorController(new ErrorMessageComponent(errDiv));
  ec.addEventListener('suspend', () => { createBtn.disabled = true; });
  ec.addEventListener('unsuspend', () => { createBtn.disabled = false; });
  newChatForm.addEventListener('submit', e => createNewChat(e, newChatForm, ec));
}

init();
