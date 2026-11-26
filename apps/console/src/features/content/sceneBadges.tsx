import type { ModerationView, ScenePublication, SceneVisibility } from '../../contracts/gap-sc-content';
import { Badge, type Tone } from '../../components/Badge';
import type { IconName } from '../../components/Icon';
import { codeText, formatInstant, label, t } from '../../i18n/t';

const PUBLICATION: Record<ScenePublication, { tone: Tone; icon: IconName }> = {
  DRAFT: { tone: 'neutral', icon: 'circle' },
  PUBLISHED: { tone: 'success', icon: 'check' },
  ARCHIVED: { tone: 'neutral', icon: 'x' },
  REMOVED: { tone: 'danger', icon: 'lock' },
};

/**
 * Publication, visibility and moderation are three separate facts (SCN S65, CON S59): they are shown as three separate
 * marks and never merged into "Published". Visibility only means something once a Scene is published. Each mark is an icon
 * plus a word. A moderation state is shown only when one exists (CON S68).
 */
export function SceneBadges({ publication, visibility, moderation }: { publication: ScenePublication; visibility: SceneVisibility; moderation: ModerationView | null }) {
  const look = PUBLICATION[publication] ?? { tone: 'neutral' as const, icon: 'circle' as const };
  return (
    <span className="badges">
      <Badge tone={look.tone} icon={look.icon}>
        {label('scene.state', publication)}
      </Badge>
      {publication === 'PUBLISHED' ? (
        visibility === 'PRIVATE' ? (
          <Badge tone="warn" icon="lock">
            {t('scene.visibility_private')}
          </Badge>
        ) : (
          <Badge tone="success" icon="check">
            {t('scene.visibility_public')}
          </Badge>
        )
      ) : null}
      {moderation ? (
        <Badge tone={moderation.state === 'PUBLISHED' ? 'success' : 'warn'} icon={moderation.state === 'PUBLISHED' ? 'check' : 'alert'}>
          {label('moderation.state', moderation.state)}
        </Badge>
      ) : null}
    </span>
  );
}

/**
 * Why a published Scene is Private. The one sentence the Console design quotes is shown for the stock reason; a reason this
 * version has no approved sentence for (including the other name of the same family, report 17 C-2) gets an honest
 * neutral line, never an invented explanation.
 */
export function PrivateReason({ reason }: { reason: string | null }) {
  if (reason === null) return null;
  return <span className="ledger-meta">{codeText('private_reason', reason) ?? t('private_reason.unknown')}</span>;
}

export function ModerationNote({ moderation, timezone }: { moderation: ModerationView; timezone: string | undefined }) {
  return (
    <dl className="facts">
      <dt>{t('moderation.state_label')}</dt>
      <dd>{label('moderation.state', moderation.state)}</dd>
      <dt>{t('moderation.updated_label')}</dt>
      <dd>
        <time dateTime={moderation.updated_at}>{formatInstant(moderation.updated_at, timezone)}</time>
      </dd>
      {moderation.reason_code ? (
        <>
          <dt>{t('moderation.reason_label')}</dt>
          <dd>{label('moderation.reason', moderation.reason_code)}</dd>
        </>
      ) : null}
    </dl>
  );
}
