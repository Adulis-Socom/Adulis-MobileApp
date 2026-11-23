import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { fillSlots } from '../api/messages';
import { AppText } from './AppText';

/** A sentence whose slot is null (fillSlots) must leave no empty line inside a gap container (BUY-04). */
describe('AppText with nothing to say', () => {
  it.each([null, undefined, false] as const)('draws nothing for %p, and still draws any other child', async (empty) => {
    await render(
      <View testID="box">
        <AppText>{empty}</AppText>
        <AppText>kept</AppText>
        <AppText>{''}</AppText>
        <AppText>{0}</AppText>
      </View>,
    );
    expect(screen.getByTestId('box').children).toHaveLength(3);
    expect(screen.getByText('kept')).toBeOnTheScreen();
  });

  it('hides a sentence whose slot is missing', async () => {
    await render(
      <View testID="box">
        <AppText>{fillSlots('Reviewed {date}', { date: null })}</AppText>
        <AppText>{fillSlots('Reviewed {date}', { date: 'Nov 8, 2026' })}</AppText>
      </View>,
    );
    expect(screen.getByTestId('box').children).toHaveLength(1);
    expect(screen.getByText('Reviewed Nov 8, 2026')).toBeOnTheScreen();
  });
});
