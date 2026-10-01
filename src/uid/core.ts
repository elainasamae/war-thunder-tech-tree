export const PUBLIC_SOURCE = 'https://raw.githubusercontent.com/elainasamae/WarThunderUIDGuard/main/data/blacklist.json';
export const SUBMISSION_ENDPOINT = 'https://formsubmit.co/ajax/a9372d4e5f4299b584b79980f413849c';
export interface PublicPlayer {
  uid: string;
  aliases: string[];
  reason: string;
  updatedAt: string | null;
}
export interface Application {
  uid: string;
  nickname: string;
  reason: string;
  evidence: string;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('黑名单格式不正确');
  return value as Record<string, unknown>;
}
export function parsePublicList(value: unknown): PublicPlayer[] {
  const root = record(value);
  const players = root.Players ?? root.players;
  if (!Array.isArray(players) || players.length > 5000) throw new Error('黑名单记录格式不正确');
  const result = new Map<string, PublicPlayer>();
  for (const raw of players) {
    const player = record(raw);
    const uid = player.Uid ?? player.uid;
    const rawAliases = player.Aliases ?? player.aliases;
    const note = player.Note ?? player.note ?? '';
    const updated = player.UpdatedAt ?? player.updatedAt;
    if (typeof uid !== 'string' || !/^\d{3,20}$/.test(uid) || !Array.isArray(rawAliases) || rawAliases.length > 100 ||
        rawAliases.some((item) => typeof item !== 'string' || item.length > 128) || typeof note !== 'string' || note.length > 5000)
      throw new Error('黑名单包含无效记录');
    const aliases = [...new Set((rawAliases as string[]).map((alias) => alias.trim().normalize()).filter(Boolean))];
    if (!aliases.length) throw new Error('黑名单记录缺少昵称');
    const prior = result.get(uid);
    result.set(uid, {
      uid, aliases: [...new Set([...(prior?.aliases ?? []), ...aliases])], reason: note.trim(),
      updatedAt: typeof updated === 'string' && Number.isFinite(Date.parse(updated)) ? updated : null,
    });
  }
  return [...result.values()].sort((a, b) => (Date.parse(b.updatedAt ?? '') || 0) - (Date.parse(a.updatedAt ?? '') || 0));
}
export function validateApplication(input: Application): string | null {
  if (!/^\d{3,20}$/.test(input.uid.trim())) return '请填写 3–20 位数字 UID';
  if (!input.nickname.trim() || input.nickname.trim().length > 128) return '请填写昵称，最多 128 个字符';
  if (input.reason.trim().length < 5 || input.reason.trim().length > 1000) return '申请原因请填写 5–1000 个字符';
  if (input.evidence.length > 1000) return '证据链接最多 1000 个字符';
  if (input.evidence.trim()) {
    const links = input.evidence.trim().split(/\s+/);
    if (links.length > 5) return '证据链接最多 5 个';
    for (const link of links) {
      try { const url = new URL(link); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(); }
      catch { return '证据请填写完整的 http 或 https 链接，每行一个'; }
    }
  }
  return null;
}
export function applicationPayload(input: Application) {
  const error = validateApplication(input);
  if (error) throw new Error(error);
  return {
    _subject: `UID Guard 黑名单添加申请 · ${input.uid.trim()}`,
    _template: 'table',
    UID: input.uid.trim(),
    昵称: input.nickname.trim(),
    申请原因: input.reason.trim(),
    证据链接: input.evidence.trim() || '未提供',
    审核说明: '请审核以上申请，审核通过后再加入黑名单。',
  };
}
export function submissionResult(value: unknown): 'accepted' | 'activation' {
  const result = record(value);
  const message = typeof result.message === 'string' ? result.message : '';
  if (/activat|confirm.*email|verif.*email/i.test(message)) return 'activation';
  if (result.success !== true && result.success !== 'true') throw new Error('邮件发送服务暂时无法接收申请，请稍后重试。');
  return 'accepted';
}
