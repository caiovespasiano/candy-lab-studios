# Candy Lab Studios

Landing page de portfolio para assets 3D e itens UGC Roblox, com painel administrativo privado.

## Stack

- React 19
- Vite 8
- Tailwind CSS 4
- JavaScript (ES Modules)
- Vitest + Testing Library

## Funcionalidades

- Hero section com identidade da marca e proposta de valor
- Galeria responsiva com modal, carrossel de imagens e sistema de curtidas por sessao
- Destaque de projeto em card especial
- Secao social com Discord e formulario de contato sanitizado
- Footer institucional
- Painel admin protegido com autenticacao em duas etapas (usuario, senha e codigo de verificacao)
- Gerenciamento de artigos: criar, editar, publicar, ocultar, reordenar por drag-and-drop e excluir
- Galeria de imagens por artigo gerenciada pelo admin
- Personalizacao da cor de fundo global da landing persistida em localStorage

## Seguranca

- Sanitizacao total de entradas e prevencao de XSS
- Tokens de sessao com expiracao
- Headers de seguranca configurados para deploy (Netlify `_headers`)
- CSP aplicada apenas no ambiente de preview/producao

## Desenvolvimento

```bash
npm install
npm run dev
```

### API de Persistencia no Projeto

- Em desenvolvimento (`npm run dev`), a API local de persistencia e servida pelo middleware do Vite.
- Em producao, a API local e servida por um backend Node dedicado.

## Producao Local

```bash
npm run build
npm run start
```

Servidor de producao:

- Frontend: `dist/`
- API: `/api/admin/articles` e `/api/admin/upload-image`
- Uploads: `public/uploads/`

## Testes

```bash
npm test
```

## Branches

- `candylabstudios` — branch de trabalho principal
- `develop` — integracao
- `master` — producao

## Estrutura

```
src/
  components/       Componentes React (AdminAccessPanel)
  constants/        Catalogos e configuracoes globais
  controllers/      Logica de dominio (artigos)
  models/           Entidades e validacoes
  network/          Mapeamento de erros HTTP
  repositories/     Persistencia em localStorage
  security/         Sanitizacao de texto
  services/         Servicos de autenticacao, sessao e preferencias
  tests/            Testes unitarios
```
