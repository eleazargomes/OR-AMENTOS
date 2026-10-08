/**
 * Backend Google Apps Script - Web App (Executar como: Eu | Acesso: Qualquer pessoa)
 * 1) Cole este arquivo no Apps Script vinculado à planilha (Extensões > Apps Script)
 * 2) Execute setup() uma vez (cria abas, gera o SALT em Propriedades do script e cria o usuário ADM)
 * 3) Implantar > Nova implantação > App da Web
 */
const ADM_LOGIN = 'ADM', ADM_SENHA = 'Formatura@2027';
const TTL = 21600; // sessão: 6h

const H = {
  Usuarios: ['id', 'nome', 'login', 'senhaHash', 'setor', 'papel', 'permissoes', 'ativo'],
  Orcamentos: ['id', 'data', 'veiculo', 'setor', 'descricao', 'solicitante', 'status', 'total'],
  Materiais_Horas: ['id', 'tipo', 'nome', 'unidade', 'valor'],
  Itens_Avulsos: ['id', 'orcamentoId', 'origem', 'descricao', 'qtd', 'unitario', 'subtotal', 'cotado']
};
// ação -> permissão de tela exigida ('*' = qualquer logado)
const ACL = {
  listarUsuarios: 'usuarios', cadastrarUsuario: 'usuarios', atualizarPermissoes: 'usuarios',
  listarOrcamentos: 'orcamentos', atualizarStatus: 'orcamentos', salvarOrcamento: 'novo',
  getOrcamento: '*', listarMateriais: '*', salvarItens: 'dimensionar',
  salvarCotacao: 'suprimentos', salvarMaterial: 'materiais', excluirMaterial: 'materiais'
};

function setup() {
  salt_(); // gera e guarda o SALT (fora do código, não vai para o GitHub)
  const ss = SpreadsheetApp.getActive();
  Object.keys(H).forEach(n => {
    const sh = ss.getSheetByName(n) || ss.insertSheet(n);
    sh.getRange(1, 1, 1, H[n].length).setValues([H[n]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  if (!read_('Usuarios').some(u => u.login === ADM_LOGIN)) {
    add_('Usuarios', { id: 'U1', nome: 'Administrador', login: ADM_LOGIN, senhaHash: hash_(ADM_SENHA), setor: '', papel: 'admin', permissoes: '[]', ativo: true });
  }
}

function doGet() { return out_({ ok: true, dados: 'API ativa' }); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const req = JSON.parse(e.postData.contents);
    const a = req.action, d = req.data || {};
    if (a === 'login') return out_({ ok: true, dados: login_(d) });
    if (!ACL[a]) throw new Error('Ação inválida');
    const u = auth_(req.token);
    if (ACL[a] !== '*' && u.papel !== 'admin' && u.permissoes.indexOf(ACL[a]) < 0) throw new Error('Sem permissão');
    return out_({ ok: true, dados: globalThis[a + '_'](d, u) });
  } catch (err) {
    return out_({ ok: false, erro: err.message, expirou: err.message === 'Sessão expirada' });
  } finally { lock.releaseLock(); }
}

// ---------- Autenticação ----------
function login_(d) {
  const u = read_('Usuarios').find(x => String(x.login).toLowerCase() === String(d.login || '').toLowerCase());
  if (!u || u.ativo === false || u.senhaHash !== hash_(d.senha || '')) throw new Error('Usuário ou senha inválidos');
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('t_' + token, u.id, TTL);
  return { token, id: u.id, nome: u.nome, login: u.login, setor: u.setor, papel: u.papel, permissoes: perms_(u) };
}
function auth_(token) {
  const id = token && CacheService.getScriptCache().get('t_' + token);
  const u = id && read_('Usuarios').find(x => x.id === id && x.ativo !== false);
  if (!u) throw new Error('Sessão expirada');
  return { id: u.id, nome: u.nome, setor: u.setor, papel: u.papel, permissoes: perms_(u) };
}
const perms_ = u => { try { return JSON.parse(u.permissoes || '[]'); } catch (e) { return []; } };
function salt_() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('SALT');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SALT', s); }
  return s;
}
const hash_ = s => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt_() + s).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');

// ---------- Usuários ----------
function listarUsuarios_() {
  return read_('Usuarios').map(u => ({ id: u.id, nome: u.nome, login: u.login, setor: u.setor, papel: u.papel, permissoes: perms_(u) }));
}
function cadastrarUsuario_(d) {
  if (!d.nome || !d.login || !d.senha) throw new Error('Preencha nome, login e senha');
  if (read_('Usuarios').some(u => String(u.login).toLowerCase() === d.login.toLowerCase())) throw new Error('Login já existe');
  const id = nextId_('Usuarios', 'U');
  add_('Usuarios', { id, nome: d.nome, login: d.login, senhaHash: hash_(d.senha), setor: d.setor || '', papel: d.papel === 'admin' ? 'admin' : 'usuario', permissoes: JSON.stringify(d.permissoes || []), ativo: true });
  return { id };
}
function atualizarPermissoes_(d) {
  const u = read_('Usuarios').find(x => x.id === d.id);
  if (!u) throw new Error('Usuário não encontrado');
  if (u.login === ADM_LOGIN) throw new Error('O usuário ADM não pode ser alterado');
  upd_('Usuarios', u, { papel: d.papel === 'admin' ? 'admin' : 'usuario', permissoes: JSON.stringify(d.permissoes || []) });
  return true;
}

// ---------- Orçamentos ----------
function listarOrcamentos_() {
  const it = read_('Itens_Avulsos');
  return read_('Orcamentos').map(o => ({
    id: o.id, data: o.data, veiculo: o.veiculo, setor: o.setor, status: o.status, total: +o.total || 0,
    pend: it.filter(i => i.orcamentoId === o.id && i.cotado !== true).length
  })).reverse();
}
function getOrcamento_(d) {
  const o = read_('Orcamentos').find(x => x.id === d.id);
  if (!o) throw new Error('Orçamento não encontrado');
  const itens = read_('Itens_Avulsos').filter(i => i.orcamentoId === d.id)
    .map(i => ({ id: i.id, origem: i.origem, descricao: i.descricao, qtd: +i.qtd, unitario: +i.unitario || 0, cotado: i.cotado === true }));
  return { orcamento: { id: o.id, veiculo: o.veiculo, setor: o.setor, descricao: o.descricao, solicitante: o.solicitante, status: o.status, total: +o.total || 0 }, itens };
}
function salvarOrcamento_(d, u) {
  if (!d.veiculo || !d.setor || !d.descricao) throw new Error('Preencha todos os campos');
  const id = nextId_('Orcamentos', 'ORC-');
  add_('Orcamentos', { id, data: new Date(), veiculo: d.veiculo, setor: d.setor, descricao: d.descricao, solicitante: u.nome, status: 'Pendente', total: 0 });
  return { id };
}
function atualizarStatus_(d) {
  if (['Aprovado', 'Rejeitado', 'Pendente'].indexOf(d.status) < 0) throw new Error('Status inválido');
  const o = read_('Orcamentos').find(x => x.id === d.id);
  if (!o) throw new Error('Orçamento não encontrado');
  upd_('Orcamentos', o, { status: d.status });
  return true;
}
function salvarItens_(d) {
  const sh = sheet_('Itens_Avulsos');
  read_('Itens_Avulsos').filter(i => i.orcamentoId === d.id).map(i => i._row).sort((a, b) => b - a).forEach(r => sh.deleteRow(r));
  let n = read_('Itens_Avulsos').length;
  (d.itens || []).forEach(i => {
    const cot = i.cotado === true, un = cot ? +i.unitario || 0 : 0;
    add_('Itens_Avulsos', { id: 'I' + d.id + '-' + (++n) + '-' + Date.now() % 1000, orcamentoId: d.id, origem: i.origem, descricao: i.descricao, qtd: +i.qtd, unitario: un, subtotal: cot ? un * i.qtd : 0, cotado: cot });
  });
  recalc_(d.id, 'Pendente');
  return true;
}
function salvarCotacao_(d) {
  const all = read_('Itens_Avulsos');
  (d.cotacoes || []).forEach(c => {
    const i = all.find(x => x.id === c.id && x.orcamentoId === d.id);
    if (i) upd_('Itens_Avulsos', i, { unitario: +c.unitario, subtotal: +c.unitario * i.qtd, cotado: true });
  });
  recalc_(d.id);
  return true;
}
function recalc_(id, status) {
  const total = read_('Itens_Avulsos').filter(i => i.orcamentoId === id && i.cotado === true).reduce((s, i) => s + (+i.subtotal || 0), 0);
  const o = read_('Orcamentos').find(x => x.id === id);
  if (o) upd_('Orcamentos', o, status ? { total, status } : { total });
}

// ---------- Materiais e Horas ----------
function listarMateriais_() { return read_('Materiais_Horas').map(m => ({ id: m.id, tipo: m.tipo, nome: m.nome, unidade: m.unidade, valor: +m.valor })); }
function salvarMaterial_(d) {
  if (!d.nome || !(+d.valor >= 0)) throw new Error('Dados inválidos');
  const id = nextId_('Materiais_Horas', 'M');
  add_('Materiais_Horas', { id, tipo: d.tipo, nome: d.nome, unidade: d.unidade, valor: +d.valor });
  return { id };
}
function excluirMaterial_(d) {
  const m = read_('Materiais_Horas').find(x => x.id === d.id);
  if (m) sheet_('Materiais_Horas').deleteRow(m._row);
  return true;
}

// ---------- Helpers de planilha ----------
const sheet_ = n => SpreadsheetApp.getActive().getSheetByName(n);
function read_(n) {
  const v = sheet_(n).getDataRange().getValues(), h = v.shift();
  return v.map((r, i) => { const o = { _row: i + 2 }; h.forEach((k, j) => o[k] = r[j]); return o; }).filter(o => o.id !== '');
}
function add_(n, o) { sheet_(n).appendRow(H[n].map(k => o[k] === undefined ? '' : o[k])); }
function upd_(n, rec, ch) { Object.keys(ch).forEach(k => sheet_(n).getRange(rec._row, H[n].indexOf(k) + 1).setValue(ch[k])); }
function nextId_(n, p) {
  const m = read_(n).reduce((a, r) => Math.max(a, parseInt(String(r.id).replace(/\D/g, ''), 10) || 0), 0) + 1;
  return p + (p === 'ORC-' ? ('000' + m).slice(-3) : m);
}
const out_ = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
