const routes = [];
let notFoundHandler = () => {};
let container = null;
let beforeEachHook = null;

function pathToRegex(path) {
  const paramNames = [];
  const pattern = path.replace(/:[^/]+/g, (m) => {
    paramNames.push(m.slice(1));
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${pattern}$`), paramNames };
}

export function registerRoute(path, handler) {
  const { regex, paramNames } = pathToRegex(path);
  routes.push({ path, regex, paramNames, handler });
}

export function setNotFound(handler) {
  notFoundHandler = handler;
}

export function beforeEach(hook) {
  beforeEachHook = hook;
}

export function navigate(hashPath) {
  if (location.hash.slice(1) === hashPath) {
    resolve();
  } else {
    location.hash = hashPath;
  }
}

function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const [pathPart, queryPart] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(queryPart || ''));
  return { path: pathPart, query };
}

async function resolve() {
  if (!container) return;
  const { path, query } = parseHash();

  for (const r of routes) {
    const match = path.match(r.regex);
    if (match) {
      const params = {};
      r.paramNames.forEach((name, i) => { params[name] = match[i + 1]; });

      if (beforeEachHook) {
        const allowed = await beforeEachHook({ path, params, query });
        if (allowed === false) return;
      }

      container.innerHTML = '';
      try {
        await r.handler(container, params, query);
      } catch (err) {
        console.error('[router] render error:', err);
      }
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      highlightNav(path);
      return;
    }
  }
  notFoundHandler(container);
}

function highlightNav(path) {
  document.querySelectorAll('[data-route]').forEach(el => {
    const target = el.getAttribute('data-route');
    el.classList.toggle('active', target === path);
  });
}

export function startRouter(rootEl) {
  container = rootEl;
  window.addEventListener('hashchange', resolve);
  resolve();
}

export function currentPath() {
  return parseHash().path;
}
