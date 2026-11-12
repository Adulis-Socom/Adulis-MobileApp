import { useHeaderHeight } from 'expo-router/react-navigation';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { DeleteAccount } from '../../../buyer/DeleteAccount';
import { Screen } from '../../../components/Screen';

/** Delete Account (WO-011): signed in only; the flow itself leaves when its session ends. */
export default function DeleteAccountRoute() {
  const headerHeight = useHeaderHeight();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      // Measured from under the header (WO-017, B-008's pattern): the header's height is the offset.
      keyboardVerticalOffset={headerHeight}
    >
      <Screen edges={['bottom', 'left', 'right']}>
        <DeleteAccount />
      </Screen>
    </KeyboardAvoidingView>
  );
}
