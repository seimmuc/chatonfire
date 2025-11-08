export class ErrorMessageComponent {
  msgElem: HTMLDivElement;
  animDuration: number;
  private timeouts: (NodeJS.Timeout | number)[] = [];
  constructor(msgElem: HTMLDivElement, animDuration: number) {
    this.msgElem = msgElem;
    this.animDuration = animDuration;
  }
  private setError(message?: string, shown?: boolean) {
    const errElem = this.msgElem;
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
          this.timeouts.push(setTimeout(gs, 1));
        } else {
          gs();
        }
      } else {
        errElem.classList.add('shrink');
        errElem.classList.remove('grow');
        if (!errElem.classList.contains('hidden')) {
          this.timeouts.push(setTimeout(() => {
            errElem.classList.add('hidden');
          }, this.animDuration));
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

export type SuspensionDuration = number | 'permanent';
export interface SuspensionEventDetail {
  type: 'start' | 'end';
  remainingDuration: SuspensionDuration | undefined;
}

export class ErrorController extends EventTarget {
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

export class FSMInitError extends Error {}

export abstract class FormSectionManager {
  formElem: HTMLFormElement;
  submitBtn: HTMLButtonElement;
  errorController: ErrorController;
  private injected = false;
  constructor(queryStrings: {errorComp: string, form: string, submitBtn: string}, errMsgAnimDur: number) {
    const errDiv = document.querySelector(queryStrings.errorComp) as HTMLDivElement | null;
    if (errDiv === null) {
      throw new FSMInitError('error message div not found');
    }
    const formElem = document.querySelector(queryStrings.form) as HTMLFormElement | null;
    if (formElem === null) {
      throw new FSMInitError('new chat form not found');
    }
    this.formElem = formElem;
    const submitBtn = document.querySelector(queryStrings.submitBtn) as HTMLButtonElement | null;
    if (submitBtn === null) {
      throw new FSMInitError('new chat create button not found');
    }
    this.submitBtn = submitBtn;
    this.errorController = new ErrorController(new ErrorMessageComponent(errDiv, errMsgAnimDur));
  }
  inject() {
    if (!this.injected) {
      this.injected = true;
      this.errorController.addEventListener('suspend', () => { this.submitBtn.disabled = true; });
      this.errorController.addEventListener('unsuspend', () => { this.submitBtn.disabled = false; });
      this.formElem.addEventListener('submit', e => this.onSubmit(e));
      this.submitBtn.disabled = this.errorController.suspended;
    }
  }
  abstract onSubmit(event: SubmitEvent): Promise<void>;
}
