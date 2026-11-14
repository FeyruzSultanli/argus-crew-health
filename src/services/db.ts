// Dexie schema v1 (doc 05 §6). Persistent offline data in IndexedDB. Only services/** talks to Dexie; the UI goes
// through the HealthService facade and the hooks in services/hooks.ts.
import Dexie, { type EntityTable, type Table } from 'dexie';

import type { Assessment, CrewMember, Observation, Packet, SignalId, Task } from '../domain/types';

export interface SettingRow {
  key: string;
  value: unknown;
}

/** Earth-link message. */
export interface MessageRow {
  id: string;
  direction: 'to-earth' | 'from-earth';
  status: string;
  sentAt: string;
  [field: string]: unknown;
}

/** Cached space-weather payloads. */
export interface SpaceWeatherRow {
  id: string;
  kind: string;
  timeTag: string;
  [field: string]: unknown;
}

export interface StreakRow {
  crewId: string;
  kind: string;
  [field: string]: unknown;
}

export interface VisionMapRow {
  id: string;
  crewId: string;
  eye: 'left' | 'right';
  missionDay: number;
  [field: string]: unknown;
}

export const DB_NAME = 'argus';

export class ArgusDB extends Dexie {
  declare crew: EntityTable<CrewMember, 'id'>;
  declare observations: EntityTable<Observation, 'id'>;
  declare assessments: Table<Assessment, [string, SignalId, number]>;
  declare tasks: EntityTable<Task, 'id'>;
  declare messages: EntityTable<MessageRow, 'id'>;
  declare packets: EntityTable<Packet, 'id'>;
  declare spaceWeather: EntityTable<SpaceWeatherRow, 'id'>;
  declare settings: EntityTable<SettingRow, 'key'>;
  declare streaks: Table<StreakRow, [string, string]>;
  declare visionMaps: EntityTable<VisionMapRow, 'id'>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      crew: 'id',
      observations: 'id, [crewId+signalId+missionDay], [crewId+missionDay], signalId, source.kind',
      assessments: '[crewId+signalId+missionDay], crewId, verdict',
      tasks: 'id, [crewId+missionDay], status',
      messages: 'id, direction, status, sentAt',
      packets: 'id, status, createdAt',
      spaceWeather: 'id, kind, timeTag',
      settings: 'key',
      streaks: '[crewId+kind]',
      visionMaps: 'id, [crewId+eye+missionDay]',
    });
  }
}

/** The app's database instance. Tests create their own `new ArgusDB(uniqueName)`. */
export const db = new ArgusDB();
