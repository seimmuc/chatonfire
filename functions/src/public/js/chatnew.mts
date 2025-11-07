import type { ACCESS_MODE, NewChatRequest, NewChatResponse, NewChatError } from '../../types/apiTypes.js';
import { FormSectionManager, FSMInitError } from './common/formmanager.mjs';


const CHAT_VISIBILITY: Record<string, ACCESS_MODE> = {'public': 'public', 'private': 'whitelist'};
const ANIM_DURATION = 1000;


class NewChatFormManager extends FormSectionManager {
  constructor() {
    super({
      errorComp: 'div#new-chat-error-msg',
      form: 'form#new-chat-form',
      submitBtn: 'form#new-chat-form > button#new-chat-create-btn'
    }, ANIM_DURATION);
  }
  static isNCRequestValid(ncReq: NewChatRequest): boolean {
    const nl = ncReq.name.trim().length;
    if (nl < 3 || nl > 50) {
      return false;
    }
    if (!['public', 'whitelist'].includes(ncReq.access)) {
      return false;
    }
    return true;
  }
  async onSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (this.errorController.suspended) {
      return;
    }
    const formData = new FormData(this.formElem, event.submitter);
    const name = formData.get('chat-name');
    const visibility = formData.get('chat-visibility');
    if (typeof name !== 'string' || typeof visibility !== 'string' || !Object.hasOwn(CHAT_VISIBILITY, visibility)) {
      this.errorController.suspend('permanent');
    }
    const access = CHAT_VISIBILITY[visibility as string];
    const ncReq: NewChatRequest = {name: name as string, access};
    if (!NewChatFormManager.isNCRequestValid(ncReq)) {
      this.errorController.handleError('Invalid input', 4000, 1500);
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
      this.errorController.handleError(ncErr.error_message, undefined, 'permanent');
    }
  }
}

function init() {
  try {
    const formManager = new NewChatFormManager();
    formManager.inject();
  } catch (e) {
    if (e instanceof FSMInitError) {
      console.error(e.message);
      return;
    } else {
      throw e;
    }
  }
}

init();
