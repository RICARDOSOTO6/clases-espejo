// ESLint del frontend (Angular 21, componentes standalone).
//
// Hasta ahora el frontend no tenía lint: solo el backend. Esta configuración
// cubre los `.ts` (reglas recomendadas de TypeScript y de Angular) y las
// plantillas (`.html`, reglas recomendadas de Angular). No se activan las
// reglas de accesibilidad de plantillas: eso es una revisión aparte de la
// Fase 5 y, si se encienden sin ese trabajo, el lint nace en rojo.
//
// El proyecto nombra sus selectores sin prefijo (`app-…` no se usa), así que
// las dos reglas de prefijo quedan apagadas a propósito.
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', '.angular/**', 'node_modules/**', 'coverage/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': 'off',
      '@angular-eslint/directive-selector': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
  },
);
