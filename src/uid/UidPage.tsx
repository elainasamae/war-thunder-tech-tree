import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Mail, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { PUBLIC_SOURCE, SUBMISSION_ENDPOINT, applicationPayload, submissionResult, parsePublicList, validateApplication, type Application, type PublicPlayer } from './core';

const emptyForm: Application = { uid: '', nickname: '', reason: '', evidence: '' };
function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '未提供日期';
}
export default function UidPage() {
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState<'public' | 'snapshot' | null>(null);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState('');
  const messageTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setLoading(true); setError('');
    async function readList() {
      try {
        const response = await fetch(PUBLIC_SOURCE, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]), cache: 'no-store', credentials: 'omit' });
        if (!response.ok) throw new Error('公开源暂不可用');
        const list = parsePublicList(await response.json());
        if (alive) { setPlayers(list); setSource('public'); setSnapshotAt(null); }
      } catch {
        if (!alive) return;
        try {
          const response = await fetch('/uid-blacklist.json', { signal: controller.signal });
          if (!response.ok) throw new Error();
          const snapshot = await response.json();
          const list = parsePublicList(snapshot.data);
          if (alive) { setPlayers(list); setSource('snapshot'); setSnapshotAt(snapshot.fetchedAt); }
        } catch { if (alive) setError('黑名单暂时无法加载，请稍后重试。'); }
      } finally { if (alive) setLoading(false); }
    }
    void readList();
    return () => { alive = false; controller.abort(); };
  }, [retry]);
  useEffect(() => () => clearTimeout(messageTimer.current), []);
  const filtered = useMemo(() => {
    const search = query.trim().normalize().toLocaleLowerCase();
    return players.filter((player) => `${player.uid} ${player.aliases.join(' ')} ${player.reason}`.normalize().toLocaleLowerCase().includes(search));
  }, [players, query]);
  const latest = players.reduce<string | null>((last, player) => player.updatedAt && (!last || Date.parse(player.updatedAt) > Date.parse(last)) ? player.updatedAt : last, null);
  function notify(text: string) {
    setMessage(text); clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => { setMessage(''); setCopied(''); }, 3500);
  }
  async function copy(text: string, id: string) {
    try { await navigator.clipboard.writeText(text); setCopied(id); notify('已复制'); }
    catch { notify('无法使用剪贴板，请手动选择并复制文本。'); }
  }
  async function submitApplication(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateApplication(form);
    if (invalid) { setFormError(invalid); return; }
    if (submitting) return;
    setFormError(''); setSubmitting(true);
    try {
      const response = await fetch(SUBMISSION_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'omit', signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ ...applicationPayload(form), _url: window.location.origin + '/u/' }),
      });
      if (!response.ok) throw new Error('邮件发送服务暂时不可用，请稍后重试。');
      const result = submissionResult(await response.json());
      if (result === 'activation') {
        setFormError('收件邮箱尚未完成开通。已通知维护者确认邮箱，请稍后再提交；你的填写内容已保留。');
      } else { setSubmitted(true); }
    } catch (failure) {
      const timedOut = failure instanceof Error && ['TimeoutError', 'AbortError'].includes(failure.name);
      setFormError(timedOut ? '发送结果尚未确认，填写内容已保留。请稍后查看后再重试，避免重复提交。' : failure instanceof TypeError ? '无法连接邮件发送服务，填写内容已保留。请检查网络后重试。' : failure instanceof Error ? failure.message : '提交失败，填写内容已保留，请稍后重试。');
    } finally { setSubmitting(false); }
  }

  return <div className="uid-page">
    <header className="uid-header">
      <a className="uid-brand" href="/"><span className="uid-brand-icon"><ShieldCheck size={22} /></span><span>WAR THUNDER <small>社区工具</small></span></a>
      <nav aria-label="项目导航"><a href="/">科技树</a><a href="/u/" aria-current="page">UID 黑名单</a></nav>
    </header>
    <main className="uid-main">
      <div className="uid-heading"><div><p className="uid-eyebrow">WAR THUNDER UID GUARD</p><h1>黑名单查询</h1><p>按 UID 记录玩家，保留已知昵称与原因。</p></div><a className="uid-apply-jump" href="#apply"><Mail size={17} /> 申请添加</a></div>
      <div className="uid-layout">
        <section className="uid-list-panel" aria-labelledby="list-title">
          <div className="uid-panel-heading"><div><h2 id="list-title">公开黑名单 <span>{loading && !source ? '—' : players.length}</span></h2><p>{source === 'snapshot' ? `公开源不可用，显示 ${dateLabel(snapshotAt)} 的副本` : '来自 UID Guard 的公开数据'}</p></div><button className="uid-icon-button" aria-label="刷新黑名单" title="刷新黑名单" disabled={loading} onClick={() => setRetry((value) => value + 1)}><RefreshCw size={18} className={loading ? 'uid-spin' : ''} /></button></div>
          <div className="uid-search"><Search size={18} /><input aria-label="搜索 UID、昵称或原因" placeholder="搜索 UID、昵称或原因…" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button aria-label="清除搜索" onClick={() => setQuery('')}><X size={16} /></button>}</div>
          {error ? <div className="uid-empty" role="alert"><p>{error}</p><button onClick={() => setRetry((value) => value + 1)}>重新加载</button></div> : loading && !source ? <div className="uid-empty" role="status">正在读取黑名单…</div> : <>
            <div className="uid-results-meta"><span>{query ? `找到 ${filtered.length} 位玩家` : `${players.length} 位玩家`}</span><span>记录最近更新 {dateLabel(latest)}</span></div>
            <div className="uid-records">
              {filtered.map((player) => <article className="uid-record" key={player.uid} data-uid={player.uid}>
                <div className="uid-record-top"><div className="uid-avatar" aria-hidden="true">{player.aliases[0].slice(0, 1).toUpperCase()}</div><div className="uid-identity"><h3>{player.aliases[0]}</h3><div className="uid-id"><span>UID</span><code>{player.uid}</code><button aria-label={`复制 UID ${player.uid}`} onClick={() => void copy(player.uid, player.uid)}>{copied === player.uid ? <Check size={14} /> : <Copy size={14} />}</button></div></div><a className="uid-official" href={`https://warthunder.com/zh/community/searchplayers/?name=${encodeURIComponent(player.uid)}`} target="_blank" rel="noopener noreferrer" aria-label={`官方查询 ${player.aliases[0]}`} title="官方玩家查询"><ExternalLink size={16} /></a></div>
                {player.aliases.length > 1 && <div className="uid-aliases"><span>其他已知昵称</span><div>{player.aliases.slice(1).map((alias) => <span key={alias}>{alias}</span>)}</div></div>}
                <div className="uid-reason"><span>记录原因</span><p className={!player.reason ? 'uid-muted' : ''}>{player.reason || '公开记录未填写原因'}</p></div>
                <div className="uid-record-date">更新于 {dateLabel(player.updatedAt)}</div>
              </article>)}
              {!filtered.length && <div className="uid-empty"><Search size={28} /><h3>{query ? '没有匹配的玩家' : '目前没有公开记录'}</h3><p>{query ? '试试 UID、其他昵称或原因关键词。' : '后续公开记录会显示在这里。'}</p>{query && <button onClick={() => setQuery('')}>清除搜索</button>}</div>}
            </div>
          </>}
          <footer className="uid-list-footer"><a href="https://github.com/elainasamae/WarThunderUIDGuard/blob/main/data/blacklist.json" target="_blank" rel="noopener noreferrer">查看公开数据 <ExternalLink size={13} /></a><span>页面仅展示公开记录</span></footer>
        </section>
        <aside className="uid-application" id="apply" aria-labelledby="apply-title">
          <div className="uid-form-heading"><span><Mail size={20} /></span><div><h2 id="apply-title">申请添加</h2><p>提供信息，交由维护者审核。</p></div></div>
          {submitted ? <div className="uid-submission-success" role="status"><span><Check size={26} /></span><h3>申请已提交</h3><p>邮件发送服务已接收你的申请，请等待维护者审核。申请不会自动加入黑名单。</p><button onClick={() => { setSubmitted(false); setForm(emptyForm); setFormError(''); }}>填写新的申请</button></div> : <form onSubmit={(event) => void submitApplication(event)} noValidate aria-busy={submitting}>
            <label htmlFor="apply-uid">玩家 UID <b>*</b></label><input id="apply-uid" inputMode="numeric" autoComplete="off" maxLength={20} placeholder="例如：123456789" value={form.uid} onChange={(event) => setForm({ ...form, uid: event.target.value })} />
            <label htmlFor="apply-nickname">当前 / 已知昵称 <b>*</b></label><input id="apply-nickname" maxLength={128} placeholder="填写玩家昵称" value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} />
            <label htmlFor="apply-reason">申请原因 <b>*</b></label><textarea id="apply-reason" maxLength={1000} rows={4} placeholder="描述具体行为、发生时间及相关情况" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /><span className="uid-character-count">{form.reason.length} / 1000</span>
            <label htmlFor="apply-evidence">证据链接 <small>选填</small></label><textarea id="apply-evidence" maxLength={1000} rows={2} placeholder="截图、回放或其他证据链接，每行一个" value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} />
            {formError && <p className="uid-form-error" role="alert">{formError}</p>}
            <button className="uid-primary" type="submit" disabled={submitting}>{submitting ? <RefreshCw size={17} className="uid-spin" /> : <Mail size={17} />} {submitting ? '正在提交…' : '提交申请'}</button>
          </form>}
          <p className="uid-form-note">无需你的邮箱。申请信息通过 <a href="https://formsubmit.co/privacy.pdf" target="_blank" rel="noopener noreferrer">FormSubmit</a> 转发给维护者，审核通过后才会加入黑名单。</p>
        </aside>
      </div>
      <footer className="uid-footer">非官方社区项目，与 Gaijin Entertainment 无隶属关系。<span>War Thunder UID Guard</span></footer>
    </main>
    {message && <div className="uid-toast" role="status">{message}</div>}
  </div>;
}
