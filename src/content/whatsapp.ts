/**
 * WhatsApp Web tool. Runs in the extension's isolated world at document_start on WhatsApp
 * Web, and is only registered while the tool is switched on.
 *
 * Blurring is done by whatsapp.css, gated by attributes this script sets on <html>. The
 * lock screen covers the page and makes it inert until the password is entered. It keeps
 * the chats out of sight of people nearby; it does not protect them from someone who can
 * use the browser's developer tools.
 */
import type { PasswordHash } from '../shared/settings/schema';
import { verifyPassword } from '../shared/password';
import {
  WHATSAPP_OPTIONS,
  optionAttribute,
  type WhatsAppCommand,
  type WhatsAppOption,
} from '../shared/site-tools';

type Options = Record<WhatsAppOption, boolean> & {
  enabled: boolean;
  autoLockMinutes: number | null;
  password: PasswordHash | null;
};

const root = document.documentElement;
let options: Options | undefined;

function apply(stored: unknown): void {
  const saved = (stored as { whatsapp?: Partial<Options> } | undefined)?.whatsapp;
  const first = options === undefined;
  options = {
    enabled: false,
    autoLockMinutes: null,
    password: null,
    ...WHATSAPP_OPTIONS,
    ...saved,
  };
  for (const option of Object.keys(WHATSAPP_OPTIONS) as WhatsAppOption[]) {
    root.toggleAttribute(optionAttribute(option), options.enabled && options[option]);
  }
  if (!options.enabled || options.password === null) unlock();
  else if (first && options.lockOnOpen) lock();
}

// Lock screen

let lockScreen: HTMLElement | undefined;

/** Material Symbols "lock" (Apache License 2.0), as in src/ui/icons.ts. */
const LOCK_ICON =
  'M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm296.5-143.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM240-160v-400 400Z';

const LOCK_STYLES = `
  :host { all: initial; position: fixed; inset: 0; z-index: 2147483647; }
  .screen {
    --surface: #f8fafd; --card: #fff; --text: #1f1f1f; --muted: #444746; --accent: #0b57d0;
    --on-accent: #fff; --field: #f0f4f9; --error: #b3261e;
    position: absolute; inset: 0; display: grid; place-items: center; padding: 24px;
    background: var(--surface); color: var(--text);
    font: 15px/22px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    .screen {
      --surface: #131314; --card: #1e1f20; --text: #e3e3e3; --muted: #c4c7c5; --accent: #a8c7fa;
      --on-accent: #062e6f; --field: #282a2c; --error: #f2b8b5;
    }
  }
  form {
    display: grid; justify-items: center; gap: 16px; width: min(360px, 100%); padding: 40px 32px 32px;
    border-radius: 28px; background: var(--card); box-shadow: 0 1px 3px rgb(0 0 0 / 12%);
  }
  .badge { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 50%;
    background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); }
  svg { width: 32px; height: 32px; fill: currentColor; }
  h1 { margin: 0; font-size: 24px; line-height: 32px; font-weight: 400; }
  p { margin: -8px 0 8px; color: var(--muted); text-align: center; }
  input { box-sizing: border-box; width: 100%; height: 52px; padding: 0 16px; border: 2px solid transparent;
    border-radius: 12px; background: var(--field); color: inherit; font: inherit; outline: 0; }
  input:focus { border-color: var(--accent); }
  .error { min-height: 20px; margin: -8px 0 0; color: var(--error); font-size: 13px; }
  button { width: 100%; height: 48px; border: 0; border-radius: 24px; background: var(--accent);
    color: var(--on-accent); font: inherit; font-weight: 500; cursor: pointer; }
  button:disabled { opacity: 0.6; cursor: default; }
`;

function lock(): void {
  if (lockScreen !== undefined || !options?.password) return;
  lockScreen = document.createElement('velo-lock-screen');
  const shadow = lockScreen.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = LOCK_STYLES;
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `
    <form>
      <div class="badge"><svg viewBox="0 -960 960 960" aria-hidden="true"><path d="${LOCK_ICON}"/></svg></div>
      <h1>WhatsApp is locked</h1>
      <p>Enter your Velo Privacy password to continue</p>
      <input type="password" autocomplete="current-password" aria-label="Password" required>
      <div class="error" role="alert"></div>
      <button type="submit">Unlock</button>
    </form>`;
  shadow.append(style, screen);

  const form = screen.querySelector('form') as HTMLFormElement;
  const input = screen.querySelector('input') as HTMLInputElement;
  const error = screen.querySelector('.error') as HTMLElement;
  const button = screen.querySelector('button') as HTMLButtonElement;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const password = options?.password;
    if (!password) return unlock();
    button.disabled = true;
    void verifyPassword(input.value, password).then((correct) => {
      button.disabled = false;
      if (correct) return unlock();
      error.textContent = 'Wrong password';
      input.select();
    });
  });

  root.append(lockScreen);
  setPageInert(true);
  input.focus();
}

function unlock(): void {
  lockScreen?.remove();
  lockScreen = undefined;
  setPageInert(false);
  lastActivity = Date.now();
}

/** Takes the page out of focus order and input while locked. */
function setPageInert(inert: boolean): void {
  if (document.body) document.body.inert = inert;
  else
    document.addEventListener('DOMContentLoaded', () => setPageInert(lockScreen !== undefined), {
      once: true,
    });
}

// Locking after a period of inactivity

let lastActivity = Date.now();
for (const type of ['pointerdown', 'keydown', 'wheel', 'mousemove'] as const) {
  addEventListener(type, () => (lastActivity = Date.now()), { capture: true, passive: true });
}
setInterval(() => {
  const minutes = options?.enabled ? options.autoLockMinutes : null;
  if (minutes !== null && minutes !== undefined && Date.now() - lastActivity > minutes * 60_000)
    lock();
}, 15_000);

// Keyboard shortcuts, relayed by the background script

chrome.runtime.onMessage.addListener((message: WhatsAppCommand) => {
  if (message.type === 'whatsapp-lock') lock();
  else if (message.type === 'whatsapp-toggle-blur') root.toggleAttribute('data-velo-revealed');
});

void chrome.storage.local.get('settings').then(({ settings }) => apply(settings));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) apply(changes.settings.newValue);
});
