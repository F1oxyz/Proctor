// =============================================================
// shared/index.ts
// Barrel de exportación del módulo shared completo.
// Importa desde aquí para consumir componentes y pipes shared:
//
//   import { NavbarComponent, BtnComponent } from '../shared';
//   import { TiempoFormatoPipe, InicialesPipe } from '../shared';
//   import { Alumno, Examen, Sesion } from '../shared';
// =============================================================

// ── Componentes ────────────────────────────────────────────
export { NavbarComponent } from './components/navbar/navbar.component';
export { BtnComponent } from './components/btn/btn.component';
export { ModalComponent } from './components/modal/modal.component';
export { BadgeComponent } from './components/badge/badge.component';
export { EmptyStateComponent } from './components/empty-state/empty-state.component';
export { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';

// ── Pipes ──────────────────────────────────────────────────
export { TiempoFormatoPipe } from './pipes/tiempo-formato.pipe';
export { InicialesPipe } from './pipes/iniciales.pipe';

// ── Modelos ────────────────────────────────────────────────
export * from './models/index';

// ── Tipos re-exportados ────────────────────────────────────
export type { BtnVariante, BtnTamano } from './components/btn/btn.component';
export type { EstadoBadge } from './components/badge/badge.component';
export type { EmptyStateIcono } from './components/empty-state/empty-state.component';