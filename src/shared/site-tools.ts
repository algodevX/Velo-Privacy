/**
 * Options of the site tools (YouTube, WhatsApp Web) and their defaults.
 *
 * Kept free of dependencies because the content scripts for those sites read them: the
 * settings schema takes its defaults from here, and the scripts fill in the same defaults
 * for anything missing from storage, without bundling the schema library.
 */

export const YOUTUBE_OPTIONS = {
  hideShorts: true,
  hideHomeFeed: false,
  hideRelated: false,
  hideEndScreen: true,
  hideComments: false,
  hideLiveChat: false,
  /** Embedded players on other sites use youtube-nocookie.com, which sets no cookies. */
  privacyEmbeds: true,
} as const;

export type YouTubeOption = keyof typeof YOUTUBE_OPTIONS;

export const WHATSAPP_OPTIONS = {
  blurNames: false,
  blurAvatars: false,
  blurPreviews: true,
  blurMessages: true,
  blurMedia: true,
  blurInput: false,
  /** Hovering over something blurred shows it. */
  revealOnHover: true,
  /** Show the lock screen when WhatsApp Web opens. Needs a password. */
  lockOnOpen: false,
} as const;

export type WhatsAppOption = keyof typeof WHATSAPP_OPTIONS;

/** Minutes of inactivity after which WhatsApp Web locks; null never locks by itself. */
export const WHATSAPP_AUTO_LOCK_MINUTES = [1, 5, 15, 30, 60] as const;

/** The `<html>` attribute a content script sets while `option` is on, e.g. `data-velo-hide-shorts`. */
export function optionAttribute(option: string): string {
  return `data-velo-${option.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

/** Messages the background sends to the WhatsApp Web content script. */
export type WhatsAppCommand = { type: 'whatsapp-lock' } | { type: 'whatsapp-toggle-blur' };

export const WHATSAPP_ORIGIN = 'https://web.whatsapp.com';
export const YOUTUBE_MATCHES = ['https://www.youtube.com/*'];
