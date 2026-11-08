import app from '../app.json';

it('keeps the canonical identifiers and the existing Expo project (founder decision D1)', () => {
  expect(app.expo.android.package).toBe('com.adulis.app');
  expect(app.expo.ios.bundleIdentifier).toBe('com.adulis.app');
  expect(app.expo.owner).toBe('naod61s-team');
  expect(app.expo.extra.eas.projectId).toBe('f1b64f7b-6725-4415-9466-d7fa7756fdbd');
});
