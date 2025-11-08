import type { UpdateSettingsError, UpdateSettingsRequest, UpdateSettingsResponse } from "../../types/apiTypes.js";
import { FormSectionManager, FSMInitError } from "./common/formmanager.mjs";


const ANIM_DURATION = 1000;


class SettingsFormManager extends FormSectionManager {
  constructor() {
    super({
      errorComp: 'div#settings-error-msg',
      form: 'form#settings-form',
      submitBtn: 'form#settings-form > button#settings-save-btn'
    }, ANIM_DURATION);
  }
  static areSettingsValid(settings: UpdateSettingsRequest['settings']): boolean {
    const ul = settings.username.trim().length;
    if (ul < 2 || ul > 30) {
      return false;
    }
    return true;
  }
  async onSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const formData = new FormData(this.formElem, event.submitter);
    const username = formData.get('username');
    if (typeof username !== 'string') {
      this.errorController.suspend('permanent');
    }
    const settingsReq: UpdateSettingsRequest = {settings: {username: username as string}};
    if (!SettingsFormManager.areSettingsValid(settingsReq.settings)) {
      this.errorController.handleError('Invalid input', 4000, 1500);
      return;
    }
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(settingsReq)
    });
    const resJson: UpdateSettingsResponse | UpdateSettingsError = await res.json();
    console.log(resJson);
    if (resJson.status === 200) {
      const ncRes = (resJson as UpdateSettingsResponse);
      // TODO show info instead of error with a different color
      this.errorController.showError('Settings saved', 4000);
    } else {
      const ncErr = (resJson as UpdateSettingsError);
      this.errorController.handleError(ncErr.error_message, undefined, 'permanent');
    }
  }
}

function init() {
  try {
    const formManager = new SettingsFormManager();
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
