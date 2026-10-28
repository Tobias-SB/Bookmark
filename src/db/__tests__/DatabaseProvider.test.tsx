import { fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import type { Db } from '../Db';
import { DatabaseProvider } from '../DatabaseProvider';
import { useDb } from '../useDb';
import { createTestDb } from '../createTestDb';

function ShowsDb() {
  useDb();
  return <Text>ready</Text>;
}

const renderError = (retry: () => void) => (
  <Pressable role="button" onPress={retry}>
    <Text>try again</Text>
  </Pressable>
);

it('useDb throws outside the provider', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await expect(renderHook(() => useDb())).rejects.toThrow('useDb() was called outside <DatabaseProvider>.');
});

it('renders nothing while opening, then the app with the database', async () => {
  let resolve!: (db: Db) => void;
  const open = () => new Promise<Db>((r) => (resolve = r));
  const onSettled = jest.fn();

  await render(
    <DatabaseProvider open={open} onSettled={onSettled} renderError={renderError}>
      <ShowsDb />
    </DatabaseProvider>,
  );
  expect(screen.queryByText('ready')).toBeNull();
  expect(onSettled).not.toHaveBeenCalled();

  resolve(createTestDb());
  expect(await screen.findByText('ready')).toBeOnTheScreen();
  expect(onSettled).toHaveBeenCalled();
});

it('shows the error screen on failure and opens again on retry', async () => {
  const open = jest
    .fn<Promise<Db>, []>()
    .mockRejectedValueOnce({ code: 'db', message: 'Database operation failed' })
    .mockResolvedValueOnce(createTestDb());
  const onSettled = jest.fn();

  await render(
    <DatabaseProvider open={open} onSettled={onSettled} renderError={renderError}>
      <ShowsDb />
    </DatabaseProvider>,
  );
  expect(await screen.findByText('try again')).toBeOnTheScreen();
  expect(onSettled).toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: 'try again' }));
  expect(await screen.findByText('ready')).toBeOnTheScreen();
  expect(open).toHaveBeenCalledTimes(2);
});
