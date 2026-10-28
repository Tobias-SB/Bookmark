import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NavRail } from '../NavRail';
import { TabBar } from '../TabBar';
import { TabItem } from '../TabItem';

const metrics = {
  frame: { x: 0, y: 0, width: 400, height: 800 },
  insets: { top: 24, left: 0, right: 0, bottom: 34 },
};

function withInsets({ children }: { children: ReactNode }) {
  return <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>;
}

describe.each([
  ['TabBar', TabBar, 'tab-bar'],
  ['NavRail', NavRail, 'nav-rail'],
] as const)('%s', (_name, Nav, testId) => {
  it('exposes a tablist of labelled tabs with the selected one announced', async () => {
    await render(
      <Nav>
        <TabItem label="Home" layout="bar" isFocused />
        <TabItem label="Library" layout="bar" />
      </Nav>,
      { wrapper: withInsets },
    );

    // The container stays non-accessible so each tab keeps its own focus stop; assert the role directly.
    expect(screen.getByTestId(testId)).toHaveProp('role', 'tablist');
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Home' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Library' })).not.toBeSelected();
    expect(screen.getByText('Library')).toBeOnTheScreen();
  });
});

it('TabBar pads the bottom safe-area inset', async () => {
  await render(<TabBar />, { wrapper: withInsets });
  expect(screen.getByTestId('tab-bar')).toHaveStyle({ paddingBottom: 38 });
});

it('TabItem reports presses', async () => {
  const onPress = jest.fn();
  await render(<TabItem label="Shelves" layout="bar" onPress={onPress} />);
  await fireEvent.press(screen.getByRole('tab', { name: 'Shelves' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
