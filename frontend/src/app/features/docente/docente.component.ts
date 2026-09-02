import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-docente',
  templateUrl: './docente.component.html',
})
export class DocenteComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  usuario = this.auth.currentUser();

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
