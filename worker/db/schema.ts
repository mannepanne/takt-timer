// ABOUT: D1 row types for users, presets, sessions, and admin tables.

export interface UserRow {
  user_handle: string;
  public_key: string; // base64url-encoded COSE public key
  counter: number;
  is_admin: number; // 0 | 1
  created_at: number; // unix ms
  language: string; // ISO 639-1 ('en' | 'sv')
  accent_colour: string; // palette ID e.g. 'lichen'
  sound_on: number; // 0 | 1
}

export interface UserSettings {
  language: string;
  accent_colour: string;
  sound_on: number;
}

export interface PresetRow {
  id: string;
  user_handle: string;
  name: string;
  sets: number;
  work_sec: number;
  rest_sec: number;
  pinned: number; // 0 | 1
  order_index: number;
  created_at: number; // unix ms
}

export interface SessionRow {
  id: string;
  user_handle: string;
  completed_at: number; // unix ms
  total_sec: number;
  sets: number;
  work_sec: number;
  rest_sec: number;
}

export interface VoiceCallRow {
  id: number;
  user_handle: string | null;
  called_at: number; // unix ms
}

export interface PurgeRunRow {
  id: number;
  ran_at: number; // unix ms
  users_deleted: number;
}

export interface AdminLogRow {
  id: number;
  action: string;
  actor: string; // CF-Access-Authenticated-User-Email
  target: string | null; // userHandle when applicable
  logged_at: number; // unix ms
}

export interface AdminUserRow {
  user_handle: string;
  created_at: number; // unix ms
  session_count: number;
  last_session_at: number | null; // unix ms
  preset_count: number;
}
