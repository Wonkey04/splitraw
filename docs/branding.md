# BRANDING.md — SplitRaw / BulkNode

> **Versión 2 — VIGENTE.** Reemplaza por completo el sistema dark-first anterior
> (`#0B0F14` / `#111827`). Cualquier referencia a esos colores en el código es legacy
> y debe eliminarse.

## Dirección

Light-first. Blanco premium enterprise. El producto se le vende a dueños de gimnasio:
tiene que leer como software serio por el que se paga una suscripción, no como una app
de fitness ni como un producto gamer.

Referencias: Stripe, Linear, Notion, Figma, OpenAI.

## Tokens de color

```
--bg-primary:      #FFFFFF   fondo de página
--bg-secondary:    #F8F9FA   sidebar, headers de tabla, superficies elevadas
--bg-tertiary:     #F0F1F3   hover states, zonas deshabilitadas
--text-primary:    #1A202C   texto principal (casi negro, no negro puro)
--text-secondary:  #6B7280   labels, texto de apoyo, placeholders
--border:          #E5E7EB   todos los bordes y divisores

--accent:          #1E3A8A   botones primarios, links, foco
--accent-hover:    #2563EB   hover de acento

--success:         #10B981
--error:           #DC2626
--warning:         #F59E0B
```

El acento vive en una sola variable. Si en algún momento se cambia el azul profundo por
otro color, se cambia ahí y en ningún otro lado.

## Tipografía

Inter, única familia. Pesos 400 / 500 / 600 / 700.

| Rol   | Tamaño | Peso | Line-height |
|-------|--------|------|-------------|
| H1    | 32px   | 700  | 1.2         |
| H2    | 24px   | 600  | 1.3         |
| H3    | 18px   | 600  | 1.4         |
| Body  | 14px   | 400  | 1.5         |
| Small | 12px   | 400  | 1.4         |
| Label | 12px   | 500  | 1.3         |

Sentence case en toda la interfaz. Nada de labels en MAYÚSCULAS.

## Espaciado

Base 8px. Todo padding, margin y gap es múltiplo de 8: `8 / 16 / 24 / 32 / 48`.
Único valor por debajo permitido: 4px, para separaciones internas de un componente
(ícono y texto dentro de un botón, por ejemplo).

## Superficies

- `border-radius: 6px` en todo. Botones, inputs, cards, modales, badges.
- **Sin sombras.** Ni `box-shadow` ni `drop-shadow`. La jerarquía se construye con
  borde de 1px y fondo, no con profundidad simulada.
- **Sin gradientes.** Ninguno, en ningún elemento.

## Componentes

**Botón primario** — fondo `--accent`, texto blanco, padding `8px 16px`, radius 6px.
Hover: `--accent-hover`.

**Botón secundario** — fondo transparente, borde 1px `--border`, texto `--text-primary`.
Hover: fondo `--bg-tertiary`.

**Botón destructivo** — fondo `--error`, texto blanco. Se usa solo para acciones
irreversibles.

**Input** — fondo blanco, borde 1px `--border`, radius 6px, padding `8px 16px`.
Foco: borde `--accent` de 2px, sin outline del browser. Placeholder en `--text-secondary`.
Error: borde `--error` + mensaje debajo en 12px `--error`.

**Card** — fondo `--bg-primary`, borde 1px `--border`, radius 6px, padding 24px.

**Tabla** — header con fondo `--bg-secondary` y texto Label. Filas separadas por borde
inferior de 1px `--border`. Hover de fila: `--bg-tertiary`. Sin bordes verticales entre
columnas.

**Badge** — fondo del color funcional al 10% de opacidad, borde 1px del color al 30%,
texto del color pleno. Tamaño Small, radius 6px, padding `4px 8px`.

**Modal** — card centrada, ancho máximo 480px, overlay `rgba(26, 32, 44, 0.4)`.

## Prohibiciones

- Sombras y gradientes de cualquier tipo.
- Iconografía de fitness: pesas, mancuernas, bíceps, siluetas.
- Fotos de stock de gente entrenando.
- Colores saturados sin función. El color comunica estado, no decora.
- Más de un radius distinto en la interfaz.
- Dark mode. No existe en esta versión. No hay toggle, no hay clase `dark:`.

## Iconografía

Lucide, trazo de 1.5px, tamaño 16px o 20px. Color heredado del texto que acompañan.

## Checklist antes de dar una pantalla por terminada

- [ ] Ningún hex hardcodeado — todo sale de las variables
- [ ] Todos los espaciados son múltiplos de 8
- [ ] Ningún `box-shadow`
- [ ] Todos los radius en 6px
- [ ] Contraste de texto sobre fondo cumple WCAG AA
- [ ] Foco de teclado visible en botones, inputs y links
- [ ] No quedó ningún color del sistema dark viejo