import { useLocalSearchParams } from 'expo-router';

import { SceneExplorer } from '../../../buyer/SceneExplorer';

/** /scenes/:scenePostRef -- the public reference only, never an internal id (WO-005). */
export default function ScenePage() {
  const { scenePostRef } = useLocalSearchParams();
  return <SceneExplorer scenePostRef={scenePostRef} />;
}
