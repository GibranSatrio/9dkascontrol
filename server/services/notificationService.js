const db = require('../db');

/**
 * Creates one notification record and fans it out to the given member ids
 * via notification_recipients. Pass an empty/omitted memberIds with
 * broadcast=true to send to every active member.
 */
function notifyMembers({ memberIds = [], broadcast = false, title, body, type = 'SYSTEM', createdBy = null }) {
  const insertNotif = db.prepare(`
    INSERT INTO notifications (title, body, type, created_by) VALUES (?, ?, ?, ?)
  `);
  const insertRecipient = db.prepare(`
    INSERT INTO notification_recipients (notification_id, member_id) VALUES (?, ?)
  `);

  const targetIds = broadcast
    ? db.prepare("SELECT id FROM members WHERE role = 'MEMBER' AND active = 1").all().map(m => m.id)
    : memberIds;

  if (targetIds.length === 0) return null;

  const tx = db.transaction(() => {
    const info = insertNotif.run(title, body, type, createdBy);
    for (const memberId of targetIds) {
      insertRecipient.run(info.lastInsertRowid, memberId);
    }
    return info.lastInsertRowid;
  });

  return tx();
}

function getForMember(memberId, { limit = 100 } = {}) {
  return db.prepare(`
    SELECT nr.id AS recipient_id, nr.read_at, n.id AS notification_id, n.title, n.body, n.type, n.created_at
    FROM notification_recipients nr
    JOIN notifications n ON n.id = nr.notification_id
    WHERE nr.member_id = ?
    ORDER BY n.created_at DESC
    LIMIT ?
  `).all(memberId, limit);
}

function unreadCount(memberId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS c FROM notification_recipients WHERE member_id = ? AND read_at IS NULL
  `).get(memberId);
  return row.c;
}

function markRead(memberId, recipientId) {
  const info = db.prepare(`
    UPDATE notification_recipients SET read_at = datetime('now')
    WHERE id = ? AND member_id = ? AND read_at IS NULL
  `).run(recipientId, memberId);
  return info.changes > 0;
}

function markAllRead(memberId) {
  db.prepare(`
    UPDATE notification_recipients SET read_at = datetime('now') WHERE member_id = ? AND read_at IS NULL
  `).run(memberId);
}

module.exports = { notifyMembers, getForMember, unreadCount, markRead, markAllRead };
