import { useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { SellerConversation } from '../../../seller/SellerMessages';

/**
 * One Buyer conversation, as the active store (WO-021). The parameter is untrusted: the screen reads
 * only a conversation id shape. The header's height offsets the keyboard (as the Buyer's, WO-016).
 */
export default function SellerConversationRoute() {
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const headerHeight = useHeaderHeight();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={headerHeight}>
      <SellerConversation conversationId={conversationId} />
    </KeyboardAvoidingView>
  );
}
