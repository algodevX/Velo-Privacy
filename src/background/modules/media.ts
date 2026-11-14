import { domainMatchPattern, domainsOf } from '../../shared/patterns';
import { togglePictureInPicture } from '../../content/pip-toggle';
import { setContentScript } from '../content-scripts';
import type { Module } from '../module';

export const TOGGLE_PIP_COMMAND = 'toggle-picture-in-picture';

/** Picture-in-picture: unlocking it everywhere, and a shortcut to pop out the main video. */
export function createMediaModule(): Module {
  return {
    name: 'media',
    sections: ['media'],

    listen() {
      chrome.commands.onCommand.addListener((command, tab) => {
        if (command === TOGGLE_PIP_COMMAND && tab?.id !== undefined) {
          void togglePictureInPictureInTab(tab.id);
        }
      });
    },

    async apply({ media }) {
      const excludeMatches = domainsOf(media.pictureInPictureExcludedSites).map(domainMatchPattern);
      await setContentScript(
        'pip-unlock',
        media.unlockPictureInPicture
          ? {
              js: ['content/pip-unlock.js'],
              matches: ['<all_urls>'],
              excludeMatches,
              runAt: 'document_start',
              allFrames: true,
              world: 'MAIN',
            }
          : null,
      );
    },
  };
}

/** Toggles picture-in-picture for the most prominent video in any frame of the tab. */
export async function togglePictureInPictureInTab(tabId: number): Promise<boolean> {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: togglePictureInPicture,
  });
  return results.some((result) => result.result === true);
}
