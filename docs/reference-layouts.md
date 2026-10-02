# Layouts de referência

Branch congelada com os padrões de layout que funcionam e que fazem parte do
design system do Candy Lab Studios.

Este arquivo documenta as classes exatas para reaproveitar em outros projetos.
A branch não é mergeada: ela existe como referencia.

---

## 1. Item da sidebar (menu lateral do admin)

Estado ativo:

```jsx
className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left bg-inkBlack font-black text-paperWhite"
```

Estado inativo:

```jsx
className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left font-bold text-inkBlack/70 transition-colors hover:bg-inkBlack/5 hover:text-inkBlack"
```

Ícone usado: `react-icons/fa`, tamanho `h-4 w-4 shrink-0`.

```jsx
<SectionLinkIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
```

Estado ativo marcado com `aria-current="true"` para leitores de tela.

**Por que funciona:** o contraste vem do preenchimento, nao da borda. `bg-inkBlack`
com `text-paperWhite` no ativo e cinza suave no inativo. Nao usa borda pesada,
porque em item de menu ela compete com o texto curto.

---

## 2. Card da lista de artigos

```jsx
className="relative list-none rounded-xl border border-inkBlack/15 bg-paperWhite p-4 transition-colors hover:border-inkBlack/40"
```

**Por que funciona:** borda de 1px em `inkBlack/15` separa do fundo sem gritar, e o
hover so escurece a borda para `inkBlack/40`. Sem sombra e sem preenchimento colorido.
O card inteiro e a area de clique, entao nao precisa de `list-none` explicito
porem o `relative` e necessario para o cursor de arrastar ficar contido.

---

## 3. Metrica (cards de publicado / rascunho / imagens / total)

```jsx
className="cute-box no-lift px-4 py-3"
```

Com rotulo e valor:

```jsx
<dt className="text-[10px] font-black uppercase tracking-widest text-inkBlack/70">{label}</dt>
<dd className="mt-1 text-3xl font-black tabular-nums leading-none text-inkBlack">{value}</dd>
```

**Por que funciona:** aqui sim o `cute-box` e apropriado, porque sao quatro
blocos de mesmo peso que precisam de presenca. `no-lift` evita que todos subam
ao mesmo tempo no hover. `tabular-nums` alinha os digitos entre cartoes.

---

## 4. Regra dehierarquia aplicada

| Elemento | Tratamento |
|---|---|
| Metricas (4 cards) | `cute-box` — mesmo peso, precisam de presenca |
| Container de Aparencia | `cute-box no-lift` — bloco unico e importante |
| Botoes de acao (topo, form, submit) | `cute-button` / `cute-control-button` |
| Item da sidebar | borda fina ou nenhuma, preenchimento para contraste |
| Card da lista de artigos | borda 1px em `inkBlack/15`, sem sombra |
| Camposets e chips | borda 1px, sem sombra |
| Mensagens de feedback | borda 1px, fundo branco |

O `.cute-box` (offset preto de `6px`) fica reservado ao que e visualmente
importante. Usar em tudo achata a hierarquia: quando tudo grita, nada grita.

---

## 5. Inputs

```css
/* index.css */
.cute-input        /* border-4 preto — formulario publico da landing */
.cute-input-soft   /* border-2 inkBlack/25, engrossa no foco — superficies administrativas */
```

```jsx
<label className="text-xs font-black uppercase tracking-wider text-inkBlack">
  Rotulo
  <input className="cute-input-soft mt-2 w-full" />
</label>
```

**Por que existem duas:** `border-4` no painel admin compete com a hierarquia dos
cartoes ao redor. A variante soft so engrossa no foco, mantendo o estado ativo
legivel.

---

## 6. Auditoria

```powershell
npm run audit:layout
```

Abre o app no Chrome instalado via `puppeteer-core` (baixa 0 bytes) e mede
geometria real com `getBoundingClientRect`. Detecta colisao, texto colado,
overflow horizontal e elemento cortado, em três telas: grid da landing, página de
produto e painel admin.

Sai com codigo 1 quando acha problema, então da para usar em hook:

```json
{ "scripts": { "precommit:layout": "npm run audit:layout" } }
```

O detector ignora de proposito o que e intencional: badge sobreposto a imagem,
modal sobre a pagina, titulo em duas linhas. Para isso descarta elementos
posicionados, a subarvore inteira de um overlay e pares de `block` empilhado, em
que gap 0 e tipografia normal.