import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'clases-espejo-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal(false);

  constructor() {
    this.aplicar(this.leerPreferencia());
  }

  toggle(): void {
    this.aplicar(!this.isDark());
  }

  private leerPreferencia(): boolean {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado === 'dark') return true;
      if (guardado === 'light') return false;
    } catch {
      /* localStorage no disponible */
    }

    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ) {
      return true;
    }

    return false;
  }

  private aplicar(oscuro: boolean): void {
    this.isDark.set(oscuro);

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute(
        'data-theme',
        oscuro ? 'dark' : 'light',
      );
    }

    try {
      localStorage.setItem(STORAGE_KEY, oscuro ? 'dark' : 'light');
    } catch {
      /* ignorar */
    }
  }
}
