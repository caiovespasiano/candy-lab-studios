# Layouts de referência

Branch congelada com os padrões de layout que funcionam e que fazem parte do
design system do Candy Lab Studios.

Este arquivo documenta as classes exatas para reaproveitar em outros projetos.
A branch não é mergeada: ela existe como referencia.

---

## 1. Item da sidebar (menu lateral do admin)

A base e a mesma para os dois estados. O que muda quando o item e o atual sao
apenas cor e peso:

```jsx
<nav aria-label="Seções do painel" className="hidden w-52 shrink-0 lg:block">
  <ul className="sticky top-24 flex flex-col gap-3">
    <li>
      <button
        type="button"
        className={`flex w-full items-center gap-2 rounded-lg border-2 border-inkBlack px-3 py-2 text-left text-sm shadow-[4px_4px_0px_0px_#111111] transition-[transform,background-color,color] duration-300 ease-out hover:scale-[1.015] hover:bg-pastelBlue hover:text-inkBlack active:scale-[0.992] ${
          isCurrentSection
            ? 'bg-inkBlack font-black text-paperWhite'
            : 'bg-paperWhite font-bold text-inkBlack/70'
        }`}
        aria-current={isCurrentSection ? 'true' : undefined}
      >
        <SectionLinkIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{sectionLink.label}</span>
      </button>
    </li>
  </ul>
</nav>
```

Ícone: `react-icons/fa`, tamanho `h-4 w-4 shrink-0`. Estado atual marcado com
`aria-current="true"` para leitores de tela.

**Por que funciona:** `text-sm` fica na classe base e nao dentro do estado. Se
so o estado inativo tivesse o `text-sm`, o item ativo subiria para 16px e
mediria 44px contra os 40px dos outros: e esse desalinhamento que faz o menu
parecer pulsar no hover, porque a lista respira a cada passagem do mouse. Com
tamanho unico, os tres itens ficam com a mesma altura e o hover pode se limitar
a escala e a cor.

O hover repete o par do resto do sistema, `hover:scale-[1.015]` e
`active:scale-[0.992]`, e `transform` entra na lista de transicao para o
movimento ser animado em vez de instantaneo. A cor de hover e `pastelBlue` tanto
no item ativo quanto no inativo: o ativo ja tem preenchimento preto, e sem a
troca de cor nao daria para saber que o mouse esta sobre ele.

Borda e sombra dura entram aqui ao contrario do resto do painel. Sao tres botoes
que acompanham a sessao inteira, e a barra lateral e a navegacao principal do
painel: eles merecem presenca de botao, nao de link de texto.

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
| Item da sidebar | `border-2` + sombra dura — navegação principal, precisa de presença de botão |
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

## 6. Descricao do artigo

Bloco de texto corrido da pagina de produto, depois da dobra da imagem.

```jsx
<section aria-labelledby="productDescriptionHeading" className="flex flex-col gap-2">
  <h3
    id="productDescriptionHeading"
    className="text-xs font-black uppercase tracking-widest text-inkBlack/60"
  >
    {translate('product.descriptionHeading')}
  </h3>
  <p className="whitespace-pre-line text-sm font-bold leading-relaxed text-inkBlack/85">
    {projectData.description}
  </p>
</section>
```

Fica dentro do container que separa o topo do restante:

```jsx
<div className="mt-6 flex flex-col gap-5 border-t border-inkBlack/15 pt-6 sm:mt-8">
```

Titulo e valor traducidos nos tres idiomas:

```json
"descriptionHeading": "Descricao completa"
```

**Contrato do dado:** `description` e uma unica string, nao um array de paragrafos.
Os paragrafos sao separados por linha em branco (`\n\n`) e o `whitespace-pre-line`
faz a quebra. Isso mantem o campo sanitizavel como texto (`sanitizeTextContent` no
modelo) e obrigatorio na validacao, que devolve `A descricao do artigo e
obrigatoria.` quando vem vazio.

**Por que funciona:** um unico `<p>` com quebras preservadas, em vez de varios
`<p>`, deixa o campo como uma caixa de texto so no admin, sem precisar de controle
de lista nem de mapear array na renderizacao. O `leading-relaxed` evita que o
texto corrido brigue com o `leading-tight` do titulo logo acima. E o titulo
reaproveita exatamente a mesma classe das outras secoes do modal, o que faz
`Descricao completa`, `Detalhes tecnicos`, `Tags` e `Sobre a producao` lerem
como um conjunto so.

**Estilo do texto:** tres paragrafos curtos, um por ideia, com linha em branco
entre eles. O primeiro diz o que e e por que foi feito, em material e cor. O
segundo explica como a peca foi construida e o que faz ela funcionar de longe.
O terceiro guarda um detalhe que se sustenta quando o asset e visto de perfil.
Sem adjetivo de marketing e sem exclamacao: o texto narra a decisao de modelagem
e deixa o leitor concluir o valor.

## 7. Auditoria

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