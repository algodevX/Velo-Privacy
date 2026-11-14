import { PRIORITY, type RuleSpec } from './dnr';
import type { Settings } from './settings/schema';

/**
 * Network rules for the YouTube tool. Element hiding is done by its content script; these
 * cover what has to happen before a page loads.
 */
export function compileYouTubeRules(youtube: Settings['youtube']): RuleSpec[] {
  if (!youtube.enabled) return [];
  const rules: RuleSpec[] = [];
  if (youtube.hideShorts) {
    // Opening a Short from a link plays it as a regular video. Navigation inside YouTube
    // does not reload the page, so the content script handles that case.
    rules.push({
      priority: PRIORITY.protection,
      action: {
        type: 'redirect',
        redirect: { regexSubstitution: String.raw`https://www.youtube.com/watch?v=\1` },
      },
      condition: {
        // The pattern takes in the whole URL, since only the matched part is replaced.
        regexFilter: String.raw`^https://(?:www\.|m\.)?youtube\.com/shorts/([\w-]+).*`,
        resourceTypes: ['main_frame'],
      },
    });
  }
  if (youtube.privacyEmbeds) {
    rules.push({
      priority: PRIORITY.protection,
      action: {
        type: 'redirect',
        redirect: { regexSubstitution: String.raw`https://www.youtube-nocookie.com/embed/\1` },
      },
      condition: {
        regexFilter: String.raw`^https://(?:www\.)?youtube\.com/embed/(.+)`,
        resourceTypes: ['sub_frame'],
      },
    });
  }
  return rules;
}
