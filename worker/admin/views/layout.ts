// ABOUT: Server-rendered HTML layout helpers for the admin backend.
// ABOUT: Plain vanilla HTML — admin is Magnus-only, English-only, no SPA overhead.

export function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function adminLayout(title: string, body: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escHtml(title)} — Takt Admin</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#212529}
    nav{display:flex;align-items:center}
    nav a{margin-right:1rem;color:#0d6efd;text-decoration:none}
    nav .nav-home{margin-right:0;margin-left:auto}
    hr{margin:1rem 0;border:0;border-top:1px solid #dee2e6}
    h1{margin-top:1.5rem;font-size:1.5rem}
    .metrics{display:flex;flex-wrap:wrap;gap:1.5rem;margin:1.5rem 0}
    .metric{padding:1rem 1.5rem;background:#f8f9fa;border-radius:6px;min-width:120px}
    .metric-value{font-size:2rem;font-weight:700;line-height:1}
    .metric-label{font-size:0.8rem;color:#6c757d;margin-top:0.25rem}
    .metric-sub{font-size:0.75rem;color:#adb5bd;margin-top:0.1rem}
    table{border-collapse:collapse;width:100%;margin:1rem 0}
    th,td{text-align:left;padding:0.5rem 0.75rem;border-bottom:1px solid #dee2e6}
    th{background:#f8f9fa;font-weight:600;width:130px}
    form{display:inline}
    input[type=text]{padding:0.375rem 0.75rem;font-size:1rem;border:1px solid #ced4da;border-radius:4px}
    .btn{padding:0.375rem 0.75rem;font-size:1rem;border-radius:4px;cursor:pointer;border:1px solid transparent;text-decoration:none;display:inline-block}
    .btn-primary{background:#0d6efd;color:#fff;border-color:#0d6efd}
    .btn-danger{background:#dc3545;color:#fff;border-color:#dc3545}
    .btn-secondary{background:#6c757d;color:#fff;border-color:#6c757d}
    .alert{padding:1rem;border-radius:4px;margin:1.5rem 0}
    .alert-warning{background:#fff3cd;border:1px solid #ffc107;color:#664d03}
    code{background:#f8f9fa;padding:0.1em 0.3em;border-radius:3px;font-size:0.9em}
  </style>
</head>
<body>
  <nav>
    <a href="/admin">Dashboard</a>
    <a href="/admin/user">User lookup</a>
    <a href="/" class="nav-home">← Takt</a>
  </nav>
  <hr>
  ${body}
</body>
</html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'no-store',
    },
  });
}
