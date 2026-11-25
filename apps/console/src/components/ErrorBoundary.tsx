import { Component, type ReactNode } from 'react';
import { t } from '../i18n/t';
import { StatePanel } from './StatePanel';

/**
 * The last line of defence: a screen that throws while rendering must never leave a blank page. It says something went
 * wrong and offers a reload, which starts again from the server's truth. Nothing about the failure is shown or logged
 * here (there is no logger in the Console and `console.*` is banned), so no Seller data can leak through an error.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main id="main" className="page narrow-page">
        <StatePanel
          page
          kind="danger"
          alert
          title={t('error.request.internal')}
          actions={
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              {t('state.retry')}
            </button>
          }
        />
      </main>
    );
  }
}
