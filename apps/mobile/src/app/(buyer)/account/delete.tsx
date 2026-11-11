import { KeyboardAvoidingView, Platform } from 'react-native';

import { DeleteAccount } from '../../../buyer/DeleteAccount';
import { Screen } from '../../../components/Screen';

/** Delete Account (WO-011): signed in only; the flow itself leaves when its session ends. */
export default function DeleteAccountRoute() {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom', 'left', 'right']}>
        <DeleteAccount />
      </Screen>
    </KeyboardAvoidingView>
  );
}
