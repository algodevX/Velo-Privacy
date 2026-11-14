import type { YouTubeOption } from '../../../shared/site-tools';
import { MasterSwitch, Section, SwitchRow } from '../../components/layout';
import type { SectionProps } from '../section';

const HIDE_OPTIONS: readonly { option: YouTubeOption; title: string; description: string }[] = [
  {
    option: 'hideShorts',
    title: 'Hide Shorts',
    description: 'Removes Shorts from every page. Links to a Short open it as a regular video.',
  },
  {
    option: 'hideHomeFeed',
    title: 'Hide recommendations on the home page',
    description: 'The home page stays empty, so you start from search or your subscriptions',
  },
  {
    option: 'hideRelated',
    title: 'Hide related videos',
    description: 'Removes the suggestions beside the video you are watching',
  },
  {
    option: 'hideEndScreen',
    title: 'Hide end screen suggestions',
    description: 'Removes the videos shown over the end of a video and after it',
  },
  {
    option: 'hideComments',
    title: 'Hide comments',
    description: 'Removes the comments below videos',
  },
  {
    option: 'hideLiveChat',
    title: 'Hide live chat',
    description: 'Removes the chat beside live streams',
  },
];

export function YouTubeSection({ settings, update }: SectionProps) {
  const { youtube } = settings;
  const set = (option: YouTubeOption) => (on: boolean) =>
    void update((draft) => {
      draft.youtube[option] = on;
    });

  return (
    <>
      <MasterSwitch
        icon="smart_display"
        title="YouTube tools"
        description="Hide Shorts, recommendations and other distractions. Nothing runs on YouTube while this is off."
        checked={youtube.enabled}
        onChange={(on) =>
          void update((draft) => {
            draft.youtube.enabled = on;
          })
        }
      />

      <Section title="What you see" description="Changes apply to open YouTube tabs right away.">
        {HIDE_OPTIONS.map(({ option, title, description }) => (
          <SwitchRow
            key={option}
            title={title}
            description={description}
            checked={youtube[option]}
            disabled={!youtube.enabled}
            onChange={set(option)}
          />
        ))}
      </Section>

      <Section title="Privacy">
        <SwitchRow
          title="Privacy-enhanced embedded videos"
          description="Videos embedded in other sites play from youtube-nocookie.com, which doesn't store cookies until you play them"
          checked={youtube.privacyEmbeds}
          disabled={!youtube.enabled}
          onChange={set('privacyEmbeds')}
        />
      </Section>
    </>
  );
}
