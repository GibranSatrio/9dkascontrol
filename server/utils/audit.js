const db = require('../db');

const insertLog = db.prepare(`
  INSERT INTO audit_logs (actor_id, actor_name, action, target_type, target_id, details, ip)
  VALUES (@actor_id, @actor_name, @action, @target_type, @target_id, @details, @ip)
`);

/**
 * Record an audit log entry. Never throws - a logging failure must not
 * break the primary request flow, but we still surface it to stderr.
 */
function logAction({ actor, action, targetType = null, targetId = null, details = null, ip = null }) {
  try {
    insertLog.run({
      actor_id: actor ? actor.id : null,
      actor_name: actor ? `${actor.absen} - ${actor.name}` : 'SYSTEM',
      action,
      target_type: targetType,
      target_id: targetId != null ? String(targetId) : null,
      details: details ? JSON.stringify(details) : null,
      ip
    });
  } catch (err) {
    console.error('[audit] failed to write audit log:', err.message);
  }
}

module.exports = { logAction };
