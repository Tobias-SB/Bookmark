import { render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { Uniwind } from 'uniwind';

import { ThemeProvider } from '../ThemeProvider';

jest.mock('uniwind', () => ({ Uniwind: { setTheme: jest.fn() } }));

const setTheme = jest.mocked(Uniwind.setTheme);

beforeEach(() => setTheme.mockClear());

it('applies the preference and renders children', async () => {
  await render(
    <ThemeProvider preference="black">
      <Text>child</Text>
    </ThemeProvider>,
  );
  expect(setTheme).toHaveBeenCalledWith('black');
  expect(screen.getByText('child')).toBeOnTheScreen();
});

it('passes system through so the device scheme keeps being followed', async () => {
  await render(
    <ThemeProvider preference="system">
      <Text>child</Text>
    </ThemeProvider>,
  );
  expect(setTheme).toHaveBeenCalledWith('system');
});

it('restyles on a preference change without remounting children', async () => {
  const mounts = jest.fn();
  function Child() {
    useEffect(mounts, []);
    return <Text>child</Text>;
  }
  const { rerender } = await render(
    <ThemeProvider preference="light">
      <Child />
    </ThemeProvider>,
  );
  await rerender(
    <ThemeProvider preference="dark">
      <Child />
    </ThemeProvider>,
  );
  expect(setTheme).toHaveBeenLastCalledWith('dark');
  expect(mounts).toHaveBeenCalledTimes(1);
});
