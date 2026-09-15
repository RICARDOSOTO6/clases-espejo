import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css',
})
export class ModalComponent {
  @Input() title = '';
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' = 'md';
  @Output() close = new EventEmitter<void>();

  closeModal(): void {
    this.close.emit();
  }
}
