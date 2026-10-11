"""Contraste WCAG 2.1 de los colores nuevos del editor del certificado.

Lee los tokens de `frontend/src/styles.css` (el `:root` y los cuatro bloques
`[data-tema='...']`), los resuelve (incluidos los alias con `var(...)`) y mide
los pares de fondo/texto que estrena el rediseño del panel. El mínimo de la
WCAG para texto normal es 4,5:1.
"""

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[0]
CSS = RAIZ / "frontend" / "src" / "styles.css"
# Sin comentarios: llevan `:` y `;` y rompen el troceado de declaraciones.
TEXT = re.sub(r"/\*.*?\*/", "", CSS.read_text(encoding="utf-8"), flags=re.S)

MINIMO = 4.5


def bloque(cabecera: str) -> dict:
    """Los tokens declarados en el bloque que empieza por `cabecera`."""
    inicio = TEXT.index(cabecera) + len(cabecera)
    fin = TEXT.index("}", inicio)
    cuerpo = TEXT[inicio:fin]
    tokens = {}
    for crudo in cuerpo.split(";"):
        if ":" not in crudo:
            continue
        nombre, _, valor = crudo.partition(":")
        nombre = nombre.strip()
        if nombre.startswith("--"):
            tokens[nombre] = valor.strip()
    return tokens


def resolver(tokens: dict, nombre: str) -> str:
    """El color final de un token, siguiendo los `var(...)` encadenados."""
    visto = 0
    valor = tokens.get(nombre)
    while valor and valor.startswith("var(") and visto < 10:
        valor = tokens.get(valor[4:].rstrip(") ").strip())
        visto += 1
    return valor or nombre


def canales(color: str):
    limpio = color.lstrip("#")
    return [int(limpio[i : i + 2], 16) for i in (0, 2, 4)]


def luminancia(color: str) -> float:
    def lineal(c: float) -> float:
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (lineal(c) for c in canales(color))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a: str, b: str) -> float:
    la, lb = luminancia(a), luminancia(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


RAIZ_TOKENS = bloque(":root {")
TEMAS = {
    tema: {**RAIZ_TOKENS, **bloque(f"[data-tema='{tema}'] {{")}
    for tema in ("AZUL", "VERDE", "VINO", "OSCURO")
}

# (etiqueta, token del texto, token del fondo) — lo que estrena el rediseño.
PARES = [
    ("resumen OK (verde)", "--success", "--success-bg"),
    ("resumen aviso (ámbar)", "--warning-text", "--warning-bg"),
    ("resumen grave (rojo)", "--danger", "--danger-bg"),
    ("icono ✓", "--success", "--success-bg"),
    ("icono ⚠", "--warning", "--warning-bg"),
    ("icono ✕", "--danger", "--danger-bg"),
    ("aviso del hueco (canvas)", "--warning", "--warning-bg"),
    ("aviso grave del hueco (canvas)", "--danger", "--danger-bg"),
    ("mensaje de aviso", "--warning", "--surface"),
    ("mensaje grave", "--danger", "--surface"),
    ("nota al pie / texto grave", "--text-aux", "--surface"),
    ("tarjeta: notas y viñetas", "--text-muted", "--surface"),
    ("título de tarjeta (uppercase)", "--text-aux", "--surface"),
    ("tabla: cabecera", "--text-aux", "--surface"),
    ("tabla: celdas", "--text", "--surface"),
    ("tabla: «con diseño»", "--text-aux", "--surface"),
    ("chip OK (Activa)", "--success-700", "--success-100"),
    ("chip neutro (Inactiva)", "--neutral-700", "--neutral-200"),
    ("contador de versiones", "--accent-texto", "--primary-100"),
    ("botón puesto (activo)", "--white-fijo", "--accent"),
    ("zoom: botones", "--accent-texto", "--surface"),
    ("ayuda: viñetas", "--text-muted", "--primary-50"),
    ("ayuda: título", "--text", "--primary-50"),
    ("botón secundario (descargas)", "--accent-texto", "--surface"),
    ("botón primario", "--white-fijo", "--primary-700"),
]

fallos = []
print(f"{'par':38} {'AZUL':>7} {'VERDE':>7} {'VINO':>7} {'OSCURO':>7}")
for etiqueta, texto, fondo in PARES:
    fila = []
    for tema, tokens in TEMAS.items():
        fg = "#ffffff" if texto == "--white-fijo" else resolver(tokens, texto)
        bg = resolver(tokens, fondo)
        ratio = contraste(fg, bg)
        fila.append(ratio)
        if ratio < MINIMO:
            fallos.append((etiqueta, tema, fg, bg, ratio))
    print(
        f"{etiqueta:38} "
        + " ".join(f"{r:6.2f}" for r in fila)
        + ("  <-- FALLA" if min(fila) < MINIMO else "")
    )

print()
if fallos:
    print("POR DEBAJO DE 4,5:1")
    for etiqueta, tema, fg, bg, ratio in fallos:
        print(f"  {etiqueta} en {tema}: {fg} sobre {bg} = {ratio:.2f}:1")
    sys.exit(1)
print(f"Los {len(PARES)} pares llegan a 4,5:1 en los cuatro temas.")
