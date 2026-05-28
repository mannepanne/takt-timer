// ABOUT: Routes all /admin/* paths to the appropriate admin handler.

import type { Env } from '../index';
import { handleDashboard } from './dashboard';
import { handleUserLookup } from './user-lookup';
import { handleDeleteUserConfirmPage, handleDeleteUserExecute } from './delete-user';

export async function handleAdmin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if ((path === '/admin' || path === '/admin/') && method === 'GET') {
    return handleDashboard(request, env);
  }
  if (path === '/admin/user' && method === 'GET') {
    return handleUserLookup(request, env);
  }
  if (path === '/admin/user-delete' && method === 'POST') {
    return handleDeleteUserConfirmPage(request, env);
  }
  if (path === '/admin/user-delete/confirm' && method === 'POST') {
    return handleDeleteUserExecute(request, env);
  }

  return new Response('Not Found', { status: 404 });
}
