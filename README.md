# Sistema de Orçamentos de Frota

Front-end estático (HTML/CSS/JS puro) + backend em Google Apps Script (Web App JSON) gravando no Google Sheets.

## Estrutura
```
├── index.html · login.html · orcamentos.html · novo-orcamento.html
├── orcamento-dimensionar.html · suprimentos-cotacao.html
├── materiais-horas.html · usuarios.html
├── css/style.css          (identidade visual única)
├── js/config.js           (API_URL, setores, veículos)
├── js/app.js              (sessão, permissões, menu, chamadas à API)
└── backend/codigo.gs      (Apps Script)
```

## Planilha (abas e colunas)
- **Usuarios**: id, nome, login, senhaHash, setor, papel, permissoes (JSON), ativo
- **Orcamentos**: id, data, veiculo, setor, descricao, solicitante, status, total
- **Materiais_Horas**: id, tipo (Material/Hora Interna/Hora Externa), nome, unidade, valor
- **Itens_Avulsos**: id, orcamentoId, origem (Cadastrado/Sem cadastro), descricao, qtd, unitario, subtotal, cotado

## Instalação
1. Crie uma planilha → Extensões → Apps Script → cole `backend/codigo.gs`.
2. Rode `setup()` uma vez (cria as abas, gera o `SALT` automaticamente em Propriedades do script e cria o usuário `ADM`). Não troque o SALT depois, senão as senhas deixam de valer.
3. Implantar → Nova implantação → App da Web (Executar como: Eu · Acesso: Qualquer pessoa). Copie a URL.
4. A URL já está em `js/config.js` (`API_URL`); se criar nova implantação, atualize-a.
5. Publique no GitHub Pages (Settings → Pages) ou abra `login.html` localmente.

## Permissões (chaves)
`orcamentos`, `novo`, `dimensionar`, `suprimentos`, `materiais`, `usuarios`. Papel `admin` acessa tudo. A validação é feita **também no backend** a cada requisição (token de sessão de 6h).

> Troque a senha do ADM após o primeiro acesso (altere `ADM_SENHA` antes do `setup()` ou edite a aba) e não versione senhas reais no GitHub.
