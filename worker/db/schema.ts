// ABOUT: D1 row types for users, presets, and sessions tables.

export interface UserRow {
  user_handle: string;
  public_key: string; // base64url-encoded COSE public key
  counter: number;
  is_admin: number; // 0 | 1
  created_at: number; // unix ms
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
