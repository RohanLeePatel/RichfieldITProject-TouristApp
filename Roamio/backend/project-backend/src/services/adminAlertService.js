const prisma = require('../config/prisma');
const { checkAll } = require('./healthService');
const feedback = require('./destinationFeedbackService');
const emailService = require('./emailService');

// Emails the admins (ADMIN_USER_IDS) when a service goes down or places get flagged by
// travellers. It only emails when that set of problems changes, so a service that
// stays down is one email, not one every run.
// What was last emailed is kept in AdminAlertState, so restarts and serverless cold starts
// don't repeat it. If the table isn't there yet (migration not run) it falls back to memory.
let memory = '';
const readSent = async () => {
  try {
    return (await prisma.adminAlertState.findUnique({ where: { id: 1 } }))?.signature ?? '';
  } catch {
    return memory;
  }
};
const writeSent = async (signature) => {
  memory = signature;
  try {
    await prisma.adminAlertState.upsert({ where: { id: 1 }, create: { id: 1, signature }, update: { signature } });
  } catch {
    /* memory copy is enough */
  }
};

const adminIds = () =>
  (process.env.ADMIN_USER_IDS || '').split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !Number.isNaN(id));

// "not configured" services are a setup choice, not an outage
const isDown = (service) => service.status === 'down' && !/not configured/.test(service.detail || '');

async function problems() {
  const [services, reports] = await Promise.all([checkAll(), feedback.openReports()]);
  return {
    down: Object.entries(services).filter(([, s]) => isDown(s)).map(([name, s]) => `${name}: ${s.detail || 'not responding'}`),
    flagged: reports.filter((r) => r.flagged).map((r) => `${r.name} (${r.reportCount} reports)`),
  };
}

async function check() {
  try {
    const { down, flagged } = await problems();
    const key = JSON.stringify([down.map((d) => d.split(':')[0]).sort(), flagged.map((f) => f.split(' (')[0]).sort()]);
    if (key === (await readSent())) return { sent: false };
    await writeSent(key);
    if (!down.length && !flagged.length) return { sent: false };
    const users = adminIds().length ? await prisma.user.findMany({ where: { id: { in: adminIds() }, deletedAt: null }, select: { email: true } }) : [];
    const text = [
      down.length ? `Services down:\n${down.map((d) => `- ${d}`).join('\n')}` : '',
      flagged.length ? `Places flagged by travellers:\n${flagged.map((f) => `- ${f}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n');
    const subject = [down.length && `${down.length} service${down.length === 1 ? '' : 's'} down`, flagged.length && `${flagged.length} place${flagged.length === 1 ? '' : 's'} flagged`].filter(Boolean).join(', ');
    return { sent: await emailService.sendAdminAlert(users.map((u) => u.email), subject, text) };
  } catch (error) {
    console.error('Admin alert check failed:', error.message);
    return { sent: false };
  }
}

module.exports = { check, isDown };
