import { compileYouTubeRules } from '../../shared/site-rules';
import { WHATSAPP_ORIGIN, YOUTUBE_MATCHES, type WhatsAppCommand } from '../../shared/site-tools';
import { setContentScript } from '../content-scripts';
import type { Module } from '../module';
import { installRules } from '../rules';

export const WHATSAPP_COMMANDS = {
  'whatsapp-lock': { type: 'whatsapp-lock' },
  'whatsapp-toggle-blur': { type: 'whatsapp-toggle-blur' },
} as const satisfies Record<string, WhatsAppCommand>;

/**
 * Tools for particular sites. Each has a master switch: while it is off, nothing is
 * registered for its site, so it costs nothing.
 */
export function createSitesModule(): Module {
  return {
    name: 'sites',
    sections: ['youtube', 'whatsapp'],

    listen() {
      chrome.commands.onCommand.addListener((command, tab) => {
        const message = WHATSAPP_COMMANDS[command as keyof typeof WHATSAPP_COMMANDS];
        if (message === undefined || tab?.id === undefined) return;
        if (!tab.url?.startsWith(`${WHATSAPP_ORIGIN}/`)) return;
        // The tab has no listener when the tool is off; that is not an error.
        chrome.tabs.sendMessage(tab.id, message).catch(() => undefined);
      });
    },

    async apply({ youtube, whatsapp }) {
      await installRules('sites', compileYouTubeRules(youtube));
      await setContentScript(
        'youtube',
        youtube.enabled
          ? {
              js: ['content/youtube.js'],
              css: ['content/youtube.css'],
              world: 'ISOLATED',
              matches: YOUTUBE_MATCHES,
              excludeMatches: [],
              runAt: 'document_start',
              allFrames: false,
            }
          : null,
      );
      await setContentScript(
        'whatsapp',
        whatsapp.enabled
          ? {
              js: ['content/whatsapp.js'],
              css: ['content/whatsapp.css'],
              world: 'ISOLATED',
              matches: [`${WHATSAPP_ORIGIN}/*`],
              excludeMatches: [],
              runAt: 'document_start',
              allFrames: false,
            }
          : null,
      );
    },
  };
}
