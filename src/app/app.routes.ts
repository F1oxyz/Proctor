import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { sessionGuard } from './core/guards/session.guard';

export const routes: Routes = [
  // Raíz → Login (docente + entrada estudiante)
  {
    path: '',
    loadComponent: () =>
      import('./features/auth/pages/login/login.component').then(m => m.LoginComponent)
  },

  // Docente (protegido por authGuard)
  {
    path: 'docente',
    canActivate: [authGuard],
    children: [
      {
        path: 'grupos',
        loadComponent: () =>
          import('./features/docente/pages/grupos/grupos.component').then(m => m.GruposComponent)
      },
      {
        path: 'examenes',
        loadComponent: () =>
          import('./features/docente/pages/examenes/examenes.component').then(m => m.ExamenesComponent)
      },
      {
        path: 'examenes/nuevo',
        loadComponent: () =>
          import('./features/docente/pages/examenes/components/exam-form/exam-form.component').then(m => m.ExamFormComponent)
      },
      {
        path: 'examenes/:id',
        loadComponent: () =>
          import('./features/docente/pages/examenes/components/exam-form/exam-form.component').then(m => m.ExamFormComponent)
      },
      {
        path: 'monitor/:sesionId',
        loadComponent: () =>
          import('./features/docente/pages/monitor/monitor.component').then(m => m.MonitorComponent)
      },
      {
        path: 'resultados/:sesionId',
        loadComponent: () =>
          import('./features/docente/pages/resultados/resultados.component').then(m => m.ResultadosComponent)
      },
      { path: '', redirectTo: 'grupos', pathMatch: 'full' }
    ]
  },

  // Estudiante (sin auth, solo código válido)
  {
    path: 'examen/:codigo',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/estudiante/pages/sala-espera/sala-espera.component').then(m => m.SalaEsperaComponent)
      },
      {
        path: 'evaluacion',
        canActivate: [sessionGuard],
        loadComponent: () =>
          import('./features/estudiante/pages/examen/examen.component').then(m => m.ExamenComponent)
      },
      {
        path: 'resultado',
        loadComponent: () =>
          import('./features/estudiante/pages/resultado-alumno/resultado-alumno.component').then(m => m.ResultadoAlumnoComponent)
      }
    ]
  },

  // Fallback
  { path: '**', redirectTo: '' }
];