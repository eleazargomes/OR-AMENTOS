const PAGES = {
  orcamentos: ['orcamentos.html', 'Orçamentos'],
  novo: ['novo-orcamento.html', 'Novo Orçamento'],
  dimensionar: ['orcamento-dimensionar.html', 'Dimensionar'],
  suprimentos: ['suprimentos-cotacao.html', 'Suprimentos'],
  materiais: ['materiais-horas.html', 'Materiais & Horas'],
  usuarios: ['usuarios.html', 'Usuários']
};
const sess = () => { try { return JSON.parse(localStorage.getItem('sess')); } catch (e) { return null; } };
const can = k => { const u = sess(); return !!u && (u.papel === 'admin' || (u.permissoes || []).includes(k)); };
const brl = n => 'R$ ' + (+n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const qs = k => new URLSearchParams(location.search).get(k);
const opts = (arr, ph) => (ph ? `<option value="">${ph}</option>` : '') + arr.map(x => `<option>${esc(x)}</option>`).join('');
const badge = s => `<span class="badge b-${String(s).toLowerCase()}">${esc(s)}</span>`;
function sair() { localStorage.removeItem('sess'); location.href = 'login.html'; }

async function api(action, data) {
  if (!API_URL || API_URL.startsWith('COLE')) throw new Error('Configure API_URL em js/config.js');
  const u = sess();
  // Corpo em texto puro evita preflight CORS no Apps Script
  const r = await (await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, token: u && u.token, data: data || {} }) })).json();
  if (!r.ok) { if (r.expirou) sair(); throw new Error(r.erro || 'Erro na requisição'); }
  return r.dados;
}

// Valida sessão/permissão e injeta menu + rodapé. Retorna false se bloqueou.
function init(key) {
  const u = sess();
  if (!u) { location.href = 'login.html'; return false; }
  if (key && !can(key)) { alert('Você não tem permissão para acessar esta tela.'); location.href = 'index.html'; return false; }
  const here = location.pathname.split('/').pop() || 'index.html';
  const li = (h, t) => `<li><a href="${h}" class="${here === h ? 'active' : ''}">${t}</a></li>`;
  const links = Object.keys(PAGES).filter(can).map(k => li(PAGES[k][0], PAGES[k][1])).join('');
  document.body.insertAdjacentHTML('afterbegin',
    `<header><div class="logo">Meu Site</div><nav><ul>${li('index.html', 'Início')}${links}<li><a onclick="sair()">Sair (${esc(u.nome)})</a></li></ul></nav></header>`);
  document.body.insertAdjacentHTML('beforeend', '<footer>&copy; 2026 Meu Site. Todos os direitos reservados.</footer>');
  return true;
}
const run = fn => fn().catch(e => alert(e.message));
