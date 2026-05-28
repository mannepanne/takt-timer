// ABOUT: Admin dashboard handler — aggregate user and session metrics from D1.

import type { Env } from '../index';
import { requireAdminAuth } from './auth';
import { adminLayout } from './views/layout.html';

export interface DashboardMetrics {
  totalUsers: number;
  newUsers7d: number;
  activeUsers7d: number;
  activeUsers30d: number;
  sessions7d: number;
  sessions30d: number;
}

export async function getDashboardMetrics(db: D1Database, now: number): Promise<DashboardMetrics> {
  const ms7d = now - 7 * 24 * 60 * 60 * 1000;
  const ms30d = now - 30 * 24 * 60 * 60 * 1000;
  const [r0, r1, r2, r3, r4, r5] = await db.batch<{ n: number }>([
    db.prepare('SELECT COUNT(*) as n FROM users'),
    db.prepare('SELECT COUNT(*) as n FROM users WHERE created_at >= ?').bind(ms7d),
    db
      .prepare('SELECT COUNT(DISTINCT user_handle) as n FROM sessions WHERE completed_at >= ?')
      .bind(ms7d),
    db
      .prepare('SELECT COUNT(DISTINCT user_handle) as n FROM sessions WHERE completed_at >= ?')
      .bind(ms30d),
    db.prepare('SELECT COUNT(*) as n FROM sessions WHERE completed_at >= ?').bind(ms7d),
    db.prepare('SELECT COUNT(*) as n FROM sessions WHERE completed_at >= ?').bind(ms30d),
  ]);
  const n = (r: D1Result<{ n: number }>) => r.results[0]?.n ?? 0;
  return {
    totalUsers: n(r0),
    newUsers7d: n(r1),
    activeUsers7d: n(r2),
    activeUsers30d: n(r3),
    sessions7d: n(r4),
    sessions30d: n(r5),
  };
}

function renderDashboard(m: DashboardMetrics): string {
  return `
<h1>Dashboard</h1>
<div class="metrics">
  <div class="metric">
    <div class="metric-value">${m.totalUsers}</div>
    <div class="metric-label">Total users</div>
    <div class="metric-sub">+${m.newUsers7d} this week</div>
  </div>
  <div class="metric">
    <div class="metric-value">${m.activeUsers7d}</div>
    <div class="metric-label">Active users (7d)</div>
    <div class="metric-sub">${m.activeUsers30d} (30d)</div>
  </div>
  <div class="metric">
    <div class="metric-value">${m.sessions7d}</div>
    <div class="metric-label">Sessions (7d)</div>
    <div class="metric-sub">${m.sessions30d} (30d)</div>
  </div>
</div>`;
}

export async function handleDashboard(request: Request, env: Env): Promise<Response> {
  const auth = requireAdminAuth(request, env);
  if (auth instanceof Response) return auth;
  const metrics = await getDashboardMetrics(env.DB, Date.now());
  return adminLayout('Dashboard', renderDashboard(metrics));
}
