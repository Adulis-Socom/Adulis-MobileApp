import type { ErrorBoundaryProps } from 'expo-router';

import { useT } from '../i18n/i18n';
import { AlertText } from './AlertText';
import { Button } from './Button';
import { Screen } from './Screen';

/**
 * The route error state (exported as the root layout's ErrorBoundary). It renders outside
 * the providers, so it uses only store-backed hooks (theme, locale) and never the session.
 * The error itself is not shown: it can carry internals a Buyer should not see.
 */
export function ErrorState({ retry }: Pick<ErrorBoundaryProps, 'retry'>) {
  const t = useT();
  return (
    <Screen centered>
      <AlertText style={{ textAlign: 'center' }}>{t('error.request.internal')}</AlertText>
      <Button label={t('common.retry')} onPress={() => void retry()} />
    </Screen>
  );
}
