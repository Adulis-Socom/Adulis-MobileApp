import { useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { ConversationScreen } from '../../../buyer/Conversation';
import { isPathName } from '../../../buyer/public-read';

/**
 * One conversation (WO-013). The reference is checked by the screen; the server decides access.
 * From Ask Seller (WO-014) it also carries the Product's public handle and slug, used only as the
 * lookup keys of the screen's own Product read, and only when both are well-formed path names.
 */
export default function ConversationRoute() {
  const { conversationRef, productHandle, productSlug } = useLocalSearchParams<{
    conversationRef?: string;
    productHandle?: string;
    productSlug?: string;
  }>();
  const product = isPathName(productHandle) && isPathName(productSlug) ? { handle: productHandle, slug: productSlug } : null;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ConversationScreen conversationRef={conversationRef} product={product} />
    </KeyboardAvoidingView>
  );
}
