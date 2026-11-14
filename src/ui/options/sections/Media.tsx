import { Section, SwitchRow } from '../../components/layout';
import { EditableList, sitePatternValidator } from '../../components/lists';
import { ShortcutRow } from '../../components/shortcut';
import type { SectionProps } from '../section';

export function MediaSection({ settings, update }: SectionProps) {
  const { media } = settings;
  return (
    <>
      <Section title="Picture-in-picture">
        <SwitchRow
          title="Allow picture-in-picture on every site"
          description="Removes the flag some sites set to hide the browser's picture-in-picture control. Reload open tabs to apply."
          checked={media.unlockPictureInPicture}
          onChange={(on) =>
            void update((draft) => {
              draft.media.unlockPictureInPicture = on;
            })
          }
        />
        <ShortcutRow
          command="toggle-picture-in-picture"
          title="Keyboard shortcut"
          description="Pops the main video of the current tab out, or back in"
        />
        <EditableList
          title="Sites to leave alone"
          items={media.pictureInPictureExcludedSites}
          onChange={(sites) =>
            void update((draft) => {
              draft.media.pictureInPictureExcludedSites = sites;
            })
          }
          validate={sitePatternValidator(media.pictureInPictureExcludedSites, ['domain'])}
          emptyText="No sites added"
          noun="a site"
          fieldLabel="Site"
          placeholder="example.com"
          helper="Includes the site's subdomains"
          sites
        />
      </Section>
    </>
  );
}
