# 🎨 Manual de Design System — CRM 4U Connect

Este documento estabelece as **diretrizes e padrões visuais obrigatórios** para todas as telas, componentes, formulários e modais do CRM 4U Connect. Qualquer novo componente, tela ou alteração futura deve seguir estritamente estas especificações.

---

## 🌈 1. Paleta de Cores e Tokens

### 1.1 Verde Primário Institucional (Ações Primárias)
| Token | Hex | Aplicação |
|---|---|---|
| `emerald-600` | `#059669` | Fundo de botões primários, abas ativas e ações principais. |
| `emerald-700` | `#047857` | Hover de botões primários e bordas de destaque. |
| `emerald-800` | `#065f46` | Active / estado pressionado de botões primários. |
| `emerald-50` | `#ecfdf5` | Badges sutis e backgrounds de destaque leve. |

> [!CAUTION]
> **Proibido o uso de tons "Verde Água Claro / Menta Fluorescente"** (`emerald-300`, `teal-300`, etc.) em botões ou estados `disabled`.

### 1.2 Neutros e Superfícies (Slate)
- **Fundo Principal da Aplicação**: `#f1f5f9` (`bg-slate-100`)
- **Superfícies de Cards e Modais**: `#ffffff` (`bg-white`)
- **Bordas Padrão de Cards e Inputs**: `#e2e8f0` (`border-slate-200`)
- **Texto Principal**: `#0f172a` (`text-slate-900`) ou `#020617` (`text-slate-950`)
- **Texto Secundário / Labels**: `#64748b` (`text-slate-500`) ou `#475569` (`text-slate-600`)

---

## 🔘 2. Padrão de Botões e Ações

Todos os botões do sistema **devem ter ícones contextuais do Lucide**, cantos refinados (`rounded-lg` / `rounded-xl`) e estados `disabled` neutros.

### 2.1 Botão Primário (Ação Principal / Submit)
```tsx
<button
  type="submit"
  disabled={loading || !isValid}
  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-emerald-700/50 text-white text-xs font-bold transition shadow-2xs cursor-pointer select-none"
>
  {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
  <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
</button>
```

### 2.2 Botão Secundário / Cancelar
```tsx
<button
  type="button"
  onClick={onClose}
  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer select-none"
>
  <X size={14} className="text-slate-400" />
  <span>Cancelar</span>
</button>
```

### 2.3 Botão Destrutivo / Excluir
```tsx
<button
  type="button"
  onClick={handleDelete}
  disabled={deleting}
  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-red-600 hover:bg-red-50 text-xs font-bold transition cursor-pointer select-none disabled:opacity-50"
>
  <Trash2 size={14} />
  <span>Excluir</span>
</button>
```

### 2.4 Regra Mandatória de Estado Modificado (*Dirty State*)
> [!IMPORTANT]
> **Todo botão de salvar edição/atualização deve ter verificação de `isDirty`**.
> O botão deve iniciar no estado `disabled` (`disabled={saving || !isDirty}`) e só ser liberado quando o usuário realizar uma modificação real em algum campo do formulário (comparando valores normalizados de textos, números, datas, arrays de tags e seletores). Isso previne escritas redundantes no banco de dados e disparos desnecessários de eventos Realtime.

---

## 📋 3. Campos de Formulário e Seletores (`CustomSelect`)

1. **Campos de Texto e Inputs**:
   - `bg-white border border-slate-200 rounded-lg text-slate-800 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`
2. **Seletores Customizados (`CustomSelect.tsx`) — OBRIGATÓRIO**:
   - **Nunca utilizar `<select>` nativo do HTML**. Todos os dropdowns e seletores do sistema devem utilizar o componente `CustomSelect.tsx`.
   - Fundo neutro `bg-white` e borda `border-slate-200 hover:border-slate-300`.
   - **NÃO** aplicar fundo esverdeado ou borda verde quando um item estiver selecionado.
   - Manter apenas o dot colorido do status ou ícone quando aplicável.
   - Suporte a estado `disabled` com fundo `bg-slate-50` e cursor `not-allowed`.

---

## 🏷️ 4. Badges de Status (`StatusBadge.tsx`)

Os badges de status em listas e tabelas usam **cores sólidas e vibrantes com texto branco**:
```tsx
<span
  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold text-white shadow-2xs whitespace-nowrap"
  style={{ backgroundColor: cfg.color_dot }}
>
  <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
  {cfg.label}
</span>
```

---

## 🪟 5. Modais e Caixas de Diálogo

- **Backdrop**: `bg-slate-950/40 backdrop-blur-xs`
- **Container**: `bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden`
- **Header**: `px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between`
- **Footer**: `px-5 py-3.5 border-t border-slate-100 bg-slate-50/40 flex items-center justify-end gap-2`

---

## 💀 6. Skeletons e Transições em Efeito Cascata

1. **Skeletons 1:1 de Alta Fidelidade**:
   - É **proibido o uso de spinners soltos no meio da tela** em páginas principais e modais complexos.
   - O skeleton deve espelhar fielmente a geometria e proporções dos elementos finais (cards, tabelas, funis, gavetas laterais).
   - Utilizar a animação `skeleton-shimmer` (`linear-gradient` com gradiente dinâmico de `slate-100` e `slate-200`).
2. **Efeito Cascata Escalonado (*Cascade In*)**:
   - Ao concluir o carregamento, os itens devem surgir suavemente de baixo para cima com a classe `.animate-cascade-item`.
   - Adicionar atraso progressivo via `style={{ animationDelay: `${index * 40}ms` }}` para gerar a sensação de cascata.
