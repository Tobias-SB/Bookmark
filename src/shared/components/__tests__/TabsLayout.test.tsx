import { renderRouter, screen } from 'expo-router/testing-library';

import TabsLayout from '../../../../app/(tabs)/_layout';
import HomeScreen from '../../../../app/(tabs)/index';
import LibraryScreen from '../../../../app/(tabs)/library';
import SettingsScreen from '../../../../app/(tabs)/settings';
import ShelvesScreen from '../../../../app/(tabs)/shelves';
import UpdatesScreen from '../../../../app/(tabs)/updates';

// jest.mock is hoisted above the imports by babel-jest.
const mockUseWindowDimensions = jest.fn();
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeScreen,
  '(tabs)/library': LibraryScreen,
  '(tabs)/shelves': ShelvesScreen,
  '(tabs)/updates': UpdatesScreen,
  '(tabs)/settings': SettingsScreen,
};

function mockWidth(width: number) {
  mockUseWindowDimensions.mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
}

it('shows the bottom tab bar at 899 px', async () => {
  mockWidth(899);
  await renderRouter(routes, { initialUrl: '/' });
  expect(screen.getByTestId('tab-bar')).toBeOnTheScreen();
  expect(screen.queryByTestId('nav-rail')).toBeNull();
});

it('shows the navigation rail at 900 px', async () => {
  mockWidth(900);
  await renderRouter(routes, { initialUrl: '/' });
  expect(screen.getByTestId('nav-rail')).toBeOnTheScreen();
  expect(screen.queryByTestId('tab-bar')).toBeNull();
});

it('renders all five tabs with the current route selected', async () => {
  mockWidth(400);
  await renderRouter(routes, { initialUrl: '/library' });
  expect(screen.getAllByRole('tab')).toHaveLength(5);
  expect(screen.getByRole('tab', { name: 'Library' })).toBeSelected();
  expect(screen.getByRole('heading', { name: 'Library' })).toBeOnTheScreen();
});
