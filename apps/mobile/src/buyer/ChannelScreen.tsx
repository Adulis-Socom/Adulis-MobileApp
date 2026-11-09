import { Placeholder } from '../components/Placeholder';
import { Screen } from '../components/Screen';
import { useT } from '../i18n/i18n';
import { CHANNELS, type ChannelName } from './channels';

/**
 * One Home channel's panel. Structure only: no feed, no Product cards, no ranking and no
 * demo data until the Scene and discovery domains exist. The Home header owns the top
 * inset and the tab bar the bottom one.
 */
export function ChannelScreen({ channel }: { channel: ChannelName }) {
  const t = useT();
  const entry = CHANNELS.find((c) => c.name === channel);
  if (!entry) return null;
  return (
    <Screen edges={['left', 'right']} centered>
      <Placeholder message={t(entry.coming)} />
    </Screen>
  );
}
