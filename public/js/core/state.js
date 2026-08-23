const listeners = new Set();

const state = {
  user: null,      // { id, absen, name, role }
  ready: false,
  unreadNotif: 0
};

export function getState() {
  return state;
}

export function setUser(user) {
  state.user = user;
  emit();
}

export function setUnreadNotif(n) {
  state.unreadNotif = n;
  emit();
}

export function setReady(v) {
  state.ready = v;
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
}
