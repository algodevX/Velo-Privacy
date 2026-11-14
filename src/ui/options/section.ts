import type { Settings } from '../../shared/settings/schema';
import type { UpdateSettings } from '../hooks';

export interface SectionProps {
  settings: Settings;
  update: UpdateSettings;
  /** The part of the address after the page, as in `#adblock/lists`. */
  subpage: string | undefined;
}
