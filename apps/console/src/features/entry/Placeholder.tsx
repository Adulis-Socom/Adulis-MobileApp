/** features/entry/Placeholder.tsx -- an honest unbuilt-screen marker. */
import { en } from '@adulis/locale';
import { fillTemplate } from '../../lib/intl';

export function Placeholder({ screen }: { screen: string }) {
  return <p className="empty">{fillTemplate(en['console.placeholder'], { screen })}</p>;
}
