import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  CATEGORIES,
  FILTER_INDEX_PATH,
  FILTER_LISTS,
  type FilterIndex,
  type FilterListInfo,
} from '../../../shared/adblock/catalog';
import { send, type ResponseMap } from '../../../shared/messages';
import type { Settings } from '../../../shared/settings/schema';
import { Button } from '../../components/controls';
import { LinkRow, Notice, Row, Section, Subpage, SwitchRow } from '../../components/layout';
import { EditableList, sitePatternValidator } from '../../components/lists';
import type { UpdateSettings } from '../../hooks';
import { plural } from '../../labels';
import type { SectionProps } from '../section';

type Status = ResponseMap['adblock-status'];

export function AdblockSection({ settings, update, subpage }: SectionProps) {
  const status = useAdblockStatus(settings.adblock);
  if (subpage === 'lists') return <FilterListsPage settings={settings} update={update} />;
  if (subpage === 'filters')
    return <MyFiltersPage settings={settings} update={update} status={status} />;
  return <AdblockPage settings={settings} update={update} status={status} />;
}

interface PageProps {
  settings: Settings;
  update: UpdateSettings;
  status?: Status;
}

function AdblockPage({ settings, update, status }: PageProps) {
  const { adblock, blocking } = settings;
  const off = !adblock.enabled;
  const customLines = adblock.customFilters.split('\n').filter(isFilterLine).length;

  return (
    <>
      <Section title="Ad blocking">
        {status?.error && <Notice kind="error">{status.error}</Notice>}
        <SwitchRow
          title="Block ads and trackers"
          description="Uses community filter lists, matched by the browser itself, so pages get faster rather than slower"
          checked={adblock.enabled}
          onChange={(on) =>
            void update((draft) => {
              draft.adblock.enabled = on;
            })
          }
        />
        <SwitchRow
          title="Hide empty ad spaces"
          description="Removes the boxes and banners left behind once their ads are blocked"
          checked={adblock.hideElements}
          disabled={off}
          onChange={(on) =>
            void update((draft) => {
              draft.adblock.hideElements = on;
            })
          }
        />
      </Section>

      <Section title="What to block">
        {CATEGORIES.filter((category) => category.id !== 'regional').map((category) => {
          const lists = FILTER_LISTS.filter((list) => list.category === category.id);
          return (
            <SwitchRow
              key={category.id}
              title={category.name}
              description={category.description}
              checked={lists.every((list) => adblock.lists.includes(list.id))}
              disabled={off}
              onChange={(on) => void setLists(update, lists, on)}
            />
          );
        })}
        <LinkRow
          title="Filter lists"
          description={`${plural(adblock.lists.length, 'list')} on, including lists for other languages`}
          href="#adblock/lists"
        />
        <LinkRow
          title="My filters"
          description={
            customLines === 0 ? 'Write your own blocking rules' : plural(customLines, 'filter')
          }
          href="#adblock/filters"
        />
      </Section>

      <Section title="Customise">
        <EditableList
          title="Sites where ads are allowed"
          description="For sites you want to support, or that break"
          items={adblock.disabledSites}
          onChange={(sites) =>
            void update((draft) => {
              draft.adblock.disabledSites = sites;
            })
          }
          validate={sitePatternValidator(adblock.disabledSites, ['domain'])}
          emptyText="No sites added"
          noun="a site"
          fieldLabel="Site"
          placeholder="example.com"
          helper="Includes the site's subdomains"
          sites
        />
        <EditableList
          title="Blocked sites"
          description="Nothing is loaded from these sites, by any page"
          items={blocking.blockedSites}
          onChange={(sites) =>
            void update((draft) => {
              draft.blocking.blockedSites = sites;
            })
          }
          validate={sitePatternValidator(blocking.blockedSites, ['domain', 'wildcard'])}
          emptyText="No sites added"
          noun="a site"
          fieldLabel="Site"
          placeholder="tracker.example"
          helper={
            <>
              Includes subdomains. Use <code>*</code> for any part of a name, as in{' '}
              <code>ads.*.example</code>.
            </>
          }
          sites
        />
      </Section>
    </>
  );
}

function FilterListsPage({ settings, update }: PageProps) {
  const { adblock } = settings;
  const index = useFilterIndex();

  return (
    <>
      <Subpage title="Filter lists" back="#adblock">
        {CATEGORIES.map((category) => (
          <Fragment key={category.id}>
            <h3 class="card-heading">
              {category.id === 'regional' ? 'Other languages' : category.name}
            </h3>
            {FILTER_LISTS.filter((list) => list.category === category.id).map((list) => {
              const rules = index?.lists.find((entry) => entry.id === list.id)?.rules;
              return (
                <SwitchRow
                  key={list.id}
                  title={list.name}
                  description={
                    rules === undefined
                      ? list.license
                      : `${plural(rules, 'rule')} · ${list.license}`
                  }
                  checked={adblock.lists.includes(list.id)}
                  disabled={!adblock.enabled}
                  onChange={(on) => void setLists(update, [list], on)}
                />
              );
            })}
          </Fragment>
        ))}
      </Subpage>
      <p class="footnote">
        Lists are updated with each release of Velo.
        {index &&
          ` The lists in this version are from ${new Date(index.builtAt).toLocaleDateString()}.`}
      </p>
    </>
  );
}

function MyFiltersPage({ settings, update, status }: PageProps) {
  const saved = settings.adblock.customFilters;
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  const dirty = draft !== saved;
  const rejected = !dirty && status ? status.rejected : [];

  const save = () =>
    void update((next) => {
      next.adblock.customFilters = draft;
    });

  return (
    <Subpage title="My filters" back="#adblock">
      <Row
        title="One filter per line, in Adblock Plus or uBlock Origin syntax"
        description={
          <>
            For example <code>||ads.example^</code> blocks a server and{' '}
            <code>example.com##.banner</code> hides an element. Lines starting with <code>!</code>{' '}
            are comments.
          </>
        }
      />
      <div class="row-block">
        <textarea
          class="textarea"
          spellcheck={false}
          rows={12}
          aria-label="My filters"
          value={draft}
          disabled={!settings.adblock.enabled}
          onInput={(event) => setDraft(event.currentTarget.value)}
        />
      </div>
      <Row
        title={
          dirty ? 'Unsaved changes' : `${plural(status?.customRules ?? 0, 'blocking rule')} active`
        }
        description={
          rejected.length > 0 ? `${plural(rejected.length, 'filter')} couldn't be used` : undefined
        }
      >
        {dirty && (
          <Button variant="text" onClick={() => setDraft(saved)}>
            Discard
          </Button>
        )}
        <Button variant="filled" disabled={!dirty} onClick={save}>
          Save
        </Button>
      </Row>
      {rejected.length > 0 && (
        <ul class="rejected">
          {rejected.map((item) => (
            <li key={item.line}>
              Line {item.line}: <code>{item.text}</code> ({item.reason})
            </li>
          ))}
        </ul>
      )}
    </Subpage>
  );
}

function isFilterLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed !== '' && !trimmed.startsWith('!') && !trimmed.startsWith('[');
}

function setLists(
  update: UpdateSettings,
  lists: readonly FilterListInfo[],
  on: boolean,
): Promise<void> {
  const ids = lists.map((list) => list.id);
  return update((draft) => {
    const others = draft.adblock.lists.filter((id) => !ids.includes(id));
    draft.adblock.lists = on ? [...others, ...ids] : others;
  });
}

/** The background applies settings asynchronously, so status is re-read shortly after changes. */
function useAdblockStatus(adblock: Settings['adblock']): Status | undefined {
  const [status, setStatus] = useState<Status>();
  useEffect(() => {
    const timer = setTimeout(() => void send({ type: 'adblock-status' }).then(setStatus), 400);
    return () => clearTimeout(timer);
  }, [adblock]);
  return status;
}

function useFilterIndex(): FilterIndex | undefined {
  const [index, setIndex] = useState<FilterIndex>();
  useEffect(() => {
    void fetch(chrome.runtime.getURL(FILTER_INDEX_PATH))
      .then((response) => response.json() as Promise<FilterIndex>)
      .then(setIndex);
  }, []);
  return index;
}
