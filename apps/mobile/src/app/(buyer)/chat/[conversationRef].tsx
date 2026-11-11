import { useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { ConversationScreen } from '../../../buyer/Conversation';

/** One conversation (WO-013). The reference is checked by the screen; the server decides access. */
export default function ConversationRoute() {
  const { conversationRef } = useLocalSearchParams<{ conversationRef?: string }>();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ConversationScreen conversationRef={conversationRef} />
    </KeyboardAvoidingView>
  );
}
