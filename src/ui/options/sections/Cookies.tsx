import type { CookieAction, CookieRule } from '../../../shared/settings/schema';
import { Row, RadioRows, Section } from '../../components/layout';
import { EditableList, sitePatternValidator } from '../../components/lists';
import { COOKIE_ACTIONS, COOKIE_ACTION_LABELS, DEFAULT_COOKIE_OPTIONS } from '../../labels';
import type { SectionProps } from '../section';

const LIST_TITLES: Record<CookieAction, string> = {
  allow: 'Always allowed to keep site data',
  session: 'Site data deleted when you close the browser',
  tab: "Site data deleted when you close the site's tabs",
  block: 'Not allowed to save data',
};

const PATTERN_HELP = (
  <>
    For example <code>example.com</code>, <code>*.example.com</code>, <code>google.*</code> or a{' '}
    <code>/regular expression/</code>
  </>
);

export function CookiesSection({ settings, update }: SectionProps) {
  const { cookies } = settings;

  const setRules = (rules: CookieRule[]) =>
    void update((draft) => {
      draft.cookies.rules = rules;
    });

  /** Replaces the rules for one action, keeping the others in their places. */
  const setListFor = (action: CookieAction, patterns: string[]) =>
    setRules([
      ...cookies.rules.filter((rule) => rule.action !== action),
      ...patterns.map((pattern) => ({ pattern, action })),
    ]);

  const moveTo = (pattern: string, action: CookieAction) =>
    setRules(cookies.rules.map((rule) => (rule.pattern === pattern ? { pattern, action } : rule)));

  return (
    <>
      <Section title="Default behaviour">
        <RadioRows
          name="default-cookie-action"
          label="Default behaviour"
          value={cookies.defaultAction}
          options={DEFAULT_COOKIE_OPTIONS}
          onChange={(action) =>
            void update((draft) => {
              draft.cookies.defaultAction = action;
            })
          }
        />
      </Section>

      <Section title="Customised behaviours">
        <Row
          title="Sites listed here use their own setting instead of the default"
          description={
            <>
              The most specific entry wins: <code>mail.example.com</code> beats{' '}
              <code>example.com</code>, which beats <code>*.example.*</code>, which beats a regular
              expression.
            </>
          }
        />
        {COOKIE_ACTIONS.map((action) => {
          const patterns = cookies.rules.filter((r) => r.action === action).map((r) => r.pattern);
          const taken = cookies.rules.map((rule) => rule.pattern);
          return (
            <EditableList
              key={action}
              title={LIST_TITLES[action]}
              items={patterns}
              onChange={(next) => setListFor(action, next)}
              validate={sitePatternValidator(
                taken,
                undefined,
                'This site already has a setting. Change it from its menu.',
              )}
              emptyText="No sites added"
              noun="a site"
              fieldLabel="Site"
              placeholder="example.com"
              helper={PATTERN_HELP}
              sites
              menuItems={(pattern) =>
                COOKIE_ACTIONS.map((choice) => ({
                  label: COOKIE_ACTION_LABELS[choice],
                  checked: choice === action,
                  onSelect: () => moveTo(pattern, choice),
                }))
              }
            />
          );
        })}
      </Section>
    </>
  );
}
