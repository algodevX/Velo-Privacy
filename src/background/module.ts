import type { Settings, SettingsSection } from '../shared/settings/schema';

/**
 * A feature area of the background worker.
 *
 * Modules translate settings into browser state (declarativeNetRequest rules, content
 * settings, registered scripts, privacy preferences) and react to browser events.
 */
export interface Module {
  readonly name: string;
  /** Settings sections this module reads; `apply` runs only when one of them changes. */
  readonly sections: readonly SettingsSection[];
  /**
   * Registers event listeners. Called synchronously on every service-worker start, as
   * Manifest V3 requires for events to wake the worker.
   */
  listen?(): void;
  /** Brings browser state in line with `settings`. Must be idempotent. */
  apply(settings: Settings): Promise<void>;
}
