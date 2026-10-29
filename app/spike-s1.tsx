import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { createExpoDb } from '@/db/createExpoDb';
import type { Db } from '@/db/Db';
import { t } from '@/shared/i18n';
import { isAppError } from '@/shared/types/errors';

// Throwaway spike S1 (spec §21): delete this route once the spike result is recorded.
const SCRATCH_DB = 'spike-s1.db';
const FIVE_MB = 5 * 1024 * 1024;

interface Estimate { usage: string; quota: string }

function describe(error: unknown): string {
  if (isAppError(error)) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

// Feature-detected, so the native build never touches browser storage.
async function readStorage(): Promise<Estimate> {
  const storage = globalThis.navigator?.storage;
  if (!storage) return { usage: t('spike.s1.unsupported'), quota: t('spike.s1.unsupported') };
  const { usage, quota } = await storage.estimate();
  return { usage: String(usage ?? '?'), quota: String(quota ?? '?') };
}

async function requestPersist(): Promise<string> {
  const storage = globalThis.navigator?.storage;
  if (!storage?.persist) return t('spike.s1.unsupported');
  return (await storage.persist()) ? t('spike.s1.granted') : t('spike.s1.denied');
}

function Line({ label, value }: { label: string; value: string }) {
  const text = `${label}: ${value}`;
  return <Text className="text-on-surface">{text}</Text>;
}

function ActionButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-12 items-center justify-center rounded-lg bg-primary px-4 ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className="font-bold text-on-primary">{label}</Text>
    </Pressable>
  );
}

export default function SpikeS1() {
  const [db, setDb] = useState<Db | null>(null);
  const [rows, setRows] = useState('?');
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [persisted, setPersisted] = useState('?');
  const [status, setStatus] = useState(t('spike.s1.opening'));
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (target: Db) => {
    const count = await target.first<{ n: number }>('SELECT COUNT(*) AS n FROM spike_s1');
    setRows(String(count?.n ?? 0));
    setEstimate(await readStorage());
  }, []);

  const attempt = useCallback(async (target: Db, action: () => Promise<void>) => {
    setBusy(true);
    setStatus(t('spike.s1.running'));
    try {
      await action();
      await refresh(target);
      setStatus(t('spike.s1.ok'));
    } catch (error) {
      setStatus(`${t('spike.s1.failed')}: ${describe(error)}`);
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  useEffect(() => {
    void (async () => {
      try {
        const opened = await createExpoDb(SCRATCH_DB);
        await opened.exec('CREATE TABLE IF NOT EXISTS spike_s1 (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL)');
        setDb(opened);
        setPersisted(await requestPersist());
        await refresh(opened);
        setStatus(t('spike.s1.ok'));
      } catch (error) {
        setStatus(`${t('spike.s1.failed')}: ${describe(error)}`);
      }
    })();
  }, [refresh]);

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="gap-3 p-4">
      <Text role="heading" className="text-2xl text-on-surface">{t('spike.s1.title')}</Text>
      <Line label={t('spike.s1.rows')} value={rows} />
      <Line label={t('spike.s1.usage')} value={estimate?.usage ?? '?'} />
      <Line label={t('spike.s1.quota')} value={estimate?.quota ?? '?'} />
      <Line label={t('spike.s1.persist')} value={persisted} />
      <Line label={t('spike.s1.status')} value={status} />
      {db && (
        <View className="gap-3">
          <ActionButton
            label={t('spike.s1.addRow')}
            onPress={() => void attempt(db, async () => { await db.run('INSERT INTO spike_s1 (payload) VALUES (?)', ['row']); })}
            disabled={busy}
          />
          <ActionButton
            label={t('spike.s1.write5mb')}
            onPress={() => void attempt(db, async () => { await db.run('INSERT INTO spike_s1 (payload) VALUES (?)', ['x'.repeat(FIVE_MB)]); })}
            disabled={busy}
          />
        </View>
      )}
    </ScrollView>
  );
}
