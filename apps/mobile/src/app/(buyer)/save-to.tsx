import { useLocalSearchParams } from 'expo-router';

import { parsePickerParams, SaveToCollection } from '../../buyer/SaveToCollection';

/** /save-to -- Add to collection over the Product or Scene that opened it (WO-009 S15). */
export default function SaveToPage() {
  const params = useLocalSearchParams();
  return <SaveToCollection params={parsePickerParams(params)} />;
}
