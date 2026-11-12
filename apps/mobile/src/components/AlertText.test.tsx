import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { AlertText } from './AlertText';

/** WO-017 (A-001): a message that must be heard is announced, not only given the alert role. */
describe('AlertText', () => {
  it('announces its message when it appears and when it changes, and draws nothing when empty', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      const view = await render(<AlertText>Could not sign out.</AlertText>);
      expect(screen.getByRole('alert')).toHaveTextContent('Could not sign out.');
      expect(announce).toHaveBeenCalledWith('Could not sign out.');
      await view.rerender(<AlertText>Try again.</AlertText>);
      expect(announce).toHaveBeenLastCalledWith('Try again.');
      await view.rerender(<AlertText>{null}</AlertText>);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(announce).toHaveBeenCalledTimes(2);
    } finally {
      announce.mockRestore();
    }
  });
});
