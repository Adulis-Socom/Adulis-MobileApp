import { Fragment } from 'react';
import { Icon } from '../../components/Icon';
import { MetricValue } from '../../components/MetricValue';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { formatInstant, label, t } from '../../i18n/t';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { Section } from '../products/Section';

/**
 * Nonfinancial Insights (SC-FE-10; ANL-01 S50-S56 with its 24 November amendment, CONSOLE-02 S83-S89). Every figure is the server's projection, with
 * its window, Market time, freshness and definition version. The Console adds, divides and averages nothing, and never turns a missing figure into
 * zero: each figure is a value or one of four distinct sentences (MetricValue). Sections the account may not see are absent from the answer.
 * Figures that need real purchases are listed as not measured in this release, never shown as zero (D24-01).
 */
export function Insights() {
  const { state, retry } = useSellerQuery('insights.get', {});
  return (
    <>
      <PageTitle title={t('area.insights')}>{t('area.insights')}</PageTitle>
      <p className="lead">{t('insights.lead')}</p>
      {state.status === 'loading' ? <Skeleton rows={6} /> : null}
      {state.status === 'error' ? (
        <StatePanel kind="danger" alert title={t('insights.error_title')} actions={<button type="button" className="btn btn-primary" onClick={retry}>{t('state.retry')}</button>}>
          <p>{t('state.transport_error_body')}</p>
        </StatePanel>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <p className="hint">
            {t('insights.window', {
              days: state.data.window.days,
              from: formatInstant(state.data.window.from, state.data.timezone),
              to: formatInstant(state.data.window.to, state.data.timezone),
              timezone: state.data.timezone,
            })}
          </p>
          <p className="hint">{t('insights.as_of', { time: formatInstant(state.data.as_of, state.data.timezone) })}</p>
          {state.data.stale ? (
            <p className="notice" role="status">
              <Icon name="clock" />
              <span>{t('insights.stale')}</span>
            </p>
          ) : null}
          <p className="notice">
            <Icon name="info" />
            <span>{t('insights.privacy_note')}</span>
          </p>
          {state.data.sections.map((s) => (
            <Section key={s.code} id={`insights-${s.code.toLowerCase()}`} title={label('insights.section', s.code)}>
              {s.code === 'NOT_MEASURED' ? <p className="hint">{t('insights.not_measured_note')}</p> : null}
              <dl className="facts">
                {s.metrics.map((m) => (
                  <Fragment key={m.code}>
                    <dt>{label('insights.metric', m.code)}</dt>
                    <dd>
                      <span className="metric-value">
                        <MetricValue metric={m.metric} />
                      </span>{' '}
                      <span className="ledger-meta">{t('insights.definition', { version: m.definition_version })}</span>
                    </dd>
                  </Fragment>
                ))}
              </dl>
            </Section>
          ))}
        </>
      ) : null}
    </>
  );
}
