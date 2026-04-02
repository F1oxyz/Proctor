# Auditoría de Código — Proctor

> Fecha: 2026-04-02  
> Auditor: Claude Code  
> Alcance: `src/` completo (Angular 21, Supabase, PeerJS, Tailwind v4)

---

## ¿Qué es este proyecto?

**Proctor** es un sistema de evaluación académica con proctoring en tiempo real vía WebRTC.

```
Docente crea grupo + alumnos
→ Crea examen (preguntas opción múltiple / respuesta abierta, imágenes opcionales)
→ Inicia sesión → genera código de 6 caracteres
→ Monitor en vivo (WebRTC PeerJS: pantallas de alumnos)
→ Alumno entra con código, elige nombre, comparte pantalla
→ Sala de espera → Docente inicia → Examen → Resultados
→ Panel de resultados con calificación manual de preguntas abiertas
```

**Stack:** Angular 21.1 (standalone, signals, OnPush) · Supabase (PostgreSQL + RLS + Realtime) · PeerJS (WebRTC) · Tailwind CSS v4

---

## Resumen ejecutivo

| Categoría | Total |
|---|---|
| Archivos vacíos | **6** |
| Bugs críticos (rotura de funcionalidad) | **6** |
| Problemas altos (deuda técnica significativa) | **9** |
| Problemas medios | **10** |
| Dead code / cosmético | **10** |

---

## Archivos vacíos

Estos archivos existen pero tienen 0 bytes. Deben eliminarse o implementarse.

| Archivo | Acción |
|---|---|
| `src/app/core/interceptors/supabase.interceptor.ts` | Eliminar — idea abandonada, no se registra en ningún lugar |
| `src/app/features/auth/auth.routes.ts` | Eliminar — el routing está todo en `app.routes.ts` |
| `src/app/features/docente/docente.routes.ts` | Eliminar — ídem |
| `src/app/features/estudiante/estudiante.routes.ts` | Eliminar — ídem |
| `src/app/features/docente/pages/resultados/components/tabla-resultados/tabla-resultados.component.ts` | Eliminar — `ResultadosComponent` implementa la tabla inline |
| `src/app/app.css` | Eliminar — referenciado en `app.ts` pero los estilos globales van en `styles.css` |

---

## Bugs críticos

### 1. Import al final del archivo — `card-estudiante.component.ts:90`

```ts
// INCORRECTO — al final del archivo, después de la clase
import { inject } from '@angular/core';
```

Los imports ES modules deben estar al inicio del archivo. Funciona por hoisting de bundler (Vite/esbuild) pero viola TypeScript/ESLint conventions y puede romper con herramientas de análisis estático.

**Fix:** Mover el import al inicio del archivo junto con los demás.

---

### 2. Campo `descripcion` nunca se guarda — `exam-form.component.ts`

El formulario tiene un `FormControl` para `descripcion` y un `<textarea>` que lo muestra, pero el payload que se envía al servicio al guardar el examen no incluye ese campo.

```ts
// El form tiene:
descripcion: [examen?.descripcion ?? '']

// El payload NO lo incluye → el campo siempre se guarda como null/vacío
```

**Fix:** Incluir `descripcion: this.form.value.descripcion` en el payload de `guardar()`.

---

### 3. Atributo `descripcion` en lugar de `mensaje` — `resultados.component.ts:193`

```html
<!-- INCORRECTO — Angular ignora este atributo, el mensaje nunca se muestra -->
<app-empty-state descripcion="Ningún alumno ha enviado el examen todavía." />

<!-- CORRECTO — el input del componente se llama 'mensaje' -->
<app-empty-state mensaje="Ningún alumno ha enviado el examen todavía." />
```

**Fix:** Corregir el nombre del atributo.

---

### 4. `totalAlumnosDetectados` no es reactivo — `modal-crear-grupo.component.ts`

```ts
// BUG: FormControl.value NO es una Angular Signal
// Este computed NUNCA se recalcula cuando el usuario escribe
totalAlumnosDetectados = computed(() => {
  const val = this.form.get('listaAlumnos')?.value ?? '';
  // ...
});
```

El `computed()` de Angular Signals solo reacciona a otras Signals. `FormControl.value` es un valor plano que cambia sin notificar al sistema de signals. El contador de alumnos detectados queda fijo en 0.

**Fix:** Usar un `signal<number>` que se actualice via `valueChanges` del FormControl, o leer desde un signal intermedio que escuche el control.

---

### 5. Test roto — `app.spec.ts`

```ts
// Este h1 NO existe en el template actual (solo tiene <router-outlet />)
expect(compiled.querySelector('h1')?.textContent).toContain('Hello, proctor');
```

Es el test default del Angular CLI que nunca fue actualizado. Falla en todos los runs.

**Fix:** Actualizar el test para reflejar el componente real, o eliminar el spec si no hay intención de testearlo.

---

### 6. Componente duplicado con mismo selector — `opciones-editor/opciones-editor.component.ts`

Este archivo contiene la clase `PreguntaCardComponent` con selector `app-pregunta-card` — es la versión obsoleta del componente. La versión actual y correcta está en `pregunta-card/pregunta-card.component.ts`. Ambas tienen el mismo selector. El archivo en `opciones-editor/` no se importa en ningún lugar, pero si se importa por error se obtiene la versión vieja.

**Fix:** Eliminar `opciones-editor.component.ts`.

---

## Problemas altos (deuda técnica)

### `any` pervasivo en servicios

```ts
// En TODOS los servicios:
catch (err: any) { ... }

// En queries Supabase:
(data as any).examenes
(payload.new as any)?.estado
(sesionData as any).iniciada_en
```

El cliente Supabase JS v2 es completamente tipado con TypeScript. El uso de `any` descarta toda esa seguridad de tipos.

**Fix:** Usar `catch (err: unknown)` con narrowing, y tipar correctamente los resultados de Supabase con los tipos generados.

---

### Algoritmo de iniciales duplicado 5 veces

El mismo algoritmo `split(' ').slice(0,2).map(n => n[0].toUpperCase()).join('')` existe en:
- `navbar.component.ts`
- `examen.component.ts`
- `resultado-alumno.component.ts`
- `fila-resultado.component.ts`
- `alumno-tile.component.ts`

Hay un `InicialesPipe` en `shared/pipes` que hace exactamente esto y no se usa donde debería.

**Fix:** Eliminar las implementaciones inline y usar el pipe, o crear una función utilitaria `getInitials(name: string): string` en `shared/utils`.

---

### Algoritmo `colorAvatar` duplicado 3 veces

Mismo hash determinístico de string en:
- `tabla-alumnos.component.ts`
- `fila-resultado.component.ts`
- `alumno-tile.component.ts`

**Fix:** Extraer a `shared/utils/color-avatar.util.ts`.

---

### Formateo `mm:ss` duplicado 4+ veces

Lógica `Math.floor(s/60).toString().padStart(2,'0')` en:
- `temporizador.component.ts` (computed `tiempoFormateado`)
- `monitor-navbar.component.ts` (computed `tiempoFormateado`)
- `resultado-alumno.component.ts` (computed `tiempoFormateado`)
- `fila-resultado.component.ts` (computed `tiempoFormateado`)

Existe `TiempoFormatoPipe` en shared que hace exactamente esto.

**Fix:** Usar el pipe donde corresponde.

---

### `SesionResumen` interface duplicada

Definida con la misma estructura en `examenes.service.ts` y `sesiones.service.ts`.

**Fix:** Mover a `shared/models/sesion.model.ts` y re-exportar desde el barrel.

---

### Polling + Realtime sin coordinación

En `sesiones.service.ts` y `examen-activo.service.ts`: el polling (cada 4 segundos) no se detiene cuando Realtime confirma `SUBSCRIBED`. Ambos mecanismos hacen queries simultáneas innecesarias.

**Fix:** En el callback de `SUBSCRIBED`, cancelar el intervalo de polling.

---

### Monitor: `enviarRecordatorio` es un `console.log`

El botón "Avisar" en `alumno-tile.component.ts` emite un output que `monitor.component.ts` maneja con:

```ts
enviarRecordatorio(alumno: AlumnoEnSesion) {
  console.log('[Monitor] Enviar recordatorio a:', alumno.alumno_nombre);
}
```

Es una feature ghost: aparece en la UI pero no hace nada. El alumno nunca recibe ningún aviso.

**Fix:** Implementar la feature (vía Realtime o Supabase), o deshabilitar el botón con un tooltip "Próximamente" mientras no esté lista.

---

### Grid de columnas con clase duplicada — `monitor.component.ts`

```html
<!-- 'sm:grid-cols-3' se aplica tanto para columnas 3 como para columnas 4 — BUG -->
[class.sm:grid-cols-3]="columnas() === 3"
[class.lg:grid-cols-3]="columnas() === 3"
[class.sm:grid-cols-3]="columnas() === 4"   <!-- DUPLICADO -->
[class.lg:grid-cols-4]="columnas() === 4"
```

Cuando `columnas()` es 4, el grid en mobile se queda en 3 columnas (por la clase duplicada anterior).

**Fix:** Corregir la clase duplicada a `sm:grid-cols-4`.

---

### `guardarRespuesta()` falla silenciosamente — `examen-activo.service.ts`

```ts
// Si upsert falla, el alumno no sabe — sus respuestas quedan solo en memoria local
const { error } = await supabase.from('respuestas').upsert(...);
if (error) {
  console.warn('[ExamenActivo] Error guardando respuesta:', error);
  // ← No se actualiza this.error, no se notifica al alumno
}
```

Un alumno puede creer que sus respuestas se guardaron cuando no lo hicieron.

---

## Problemas medios

### `modal.component.ts`

1. **`anchoClase` como función flecha en lugar de `computed()`** — no es reactiva. Si `ancho()` cambia en runtime, la clase CSS no se actualiza:
   ```ts
   // INCORRECTO
   anchoClase = () => { ... };
   
   // CORRECTO
   anchoClase = computed(() => { ... });
   ```

2. **Body overflow no se limpia al destruir con modal abierto** — si el componente se destruye mientras el modal está abierto (ej: navegación rápida), `document.body.style.overflow` queda como `'hidden'` permanentemente.

---

### Inputs sin usar (dead inputs)

| Componente | Input | Estado |
|---|---|---|
| `navbar.component.ts` | `estadoSesion` | Declarado, nunca usado en template |
| `screen-share-prompt.component.ts` | `nombreAlumno` | Declarado, nunca usado en template |

---

### Dead code en componentes

| Archivo | Dead code |
|---|---|
| `app.ts` | `title = signal('proctor')` — nunca referenciado en el template |
| `examenes.component.ts` | `onCerrarModal()` — método vacío que no se llama desde ningún lugar |
| `grupos.component.ts` | `onGrupoCreado()` — método vacío; el output `Grupo` emitido por el modal se descarta |

---

### Seguridad débil en `session.guard.ts`

```ts
// Cualquier usuario puede abrir DevTools y escribir esto para bypassear el guard:
sessionStorage.setItem('proctor_alumno_ABC123', JSON.stringify({...}));
```

La autorización basada en sessionStorage es facilmente bypasseable.

**Fix:** Validar contra el estado del servicio (`ExamenActivoService`) además del sessionStorage.

---

### Supabase `anonKey` hardcodeada en el repo

```ts
// environment.ts — si este repo es público, la clave está expuesta
supabaseKey: 'sb_publishable_yIfjJV8C2iU1QbIgvJrqUw_kp_ZGFPn'
```

La `anonKey` de Supabase es "pública por diseño" (solo permite lo que RLS permite), pero aun así es mala práctica commitearla. Debería ir en variables de entorno de CI/CD.

---

### `loading-spinner.component.ts` usa API vieja de Angular

```ts
// Importa NgTemplateOutlet (API pre-17)
imports: [NgTemplateOutlet]

// Cuando el resto del proyecto usa control flow moderno
@if (overlay()) { ... } @else { ... }
```

**Fix:** Refactorizar para usar `@if / @else` nativo.

---

### Inconsistencia de validación en `card-docente.component.ts`

El validador del formulario requiere mínimo **8** caracteres:
```ts
Validators.minLength(8)
```

Pero el mensaje de error dice mínimo **6**:
```ts
'Password should be at least 6 characters'
```

El mensaje nunca se muestra en la práctica (el validador Angular rechaza antes que Supabase), pero si alguien lo ve en un edge case, la información es incorrecta.

---

### Template de imagen duplicado

El bloque HTML para mostrar imagen de pregunta con modal de zoom expandido (~50 líneas) está copiado idénticamente en:
- `pregunta-opcion-multiple.component.ts`
- `pregunta-abierta.component.ts`

**Fix:** Extraer a un componente `ImagenPreguntaComponent`.

---

## Lo que está bien

A pesar del vibecoding, la arquitectura de fondo es **sólida**:

- **Feature-based con lazy loading** — correcto y escalable
- **Angular 21 idiomático** — Signals, `input()`, `output()`, `computed()`, `effect()`, control flow `@if/@for/@switch` — todo moderno
- **`ChangeDetectionStrategy.OnPush` en todos los componentes** sin excepción
- **`ExamenShellComponent` como provider de estado** — patrón elegante para compartir servicio entre rutas hijo sin `providedIn: root`
- **Race condition en `authGuard` resuelta** con `aguardarInicializacion()` — bien pensado
- **Retry logic en PeerService** para `unavailable-id` y `peer-unavailable` — robusto
- **`fisherYates` para mezclar preguntas** — sin sesgo estadístico
- **Modelos tipados 1:1 con Supabase** con documentación inline
- **Barrel `shared/index.ts`** con re-exportaciones ordenadas
- **Accesibilidad**: `role`, `aria-label`, `aria-modal`, `aria-checked` presentes en los lugares críticos

---

## Archivos clave

```
src/
├── app/
│   ├── app.routes.ts              # Routing principal (lazy loading de features)
│   ├── app.config.ts              # Bootstrap: locale es-MX, HTTP, Router
│   ├── core/
│   │   ├── guards/
│   │   │   ├── auth.guard.ts      # Protege rutas de docente (Supabase Auth)
│   │   │   └── session.guard.ts   # Protege rutas de alumno (sessionStorage)
│   │   └── services/
│   │       ├── auth.service.ts    # Supabase Auth + signals reactivos
│   │       ├── peer.service.ts    # PeerJS WebRTC (pantalla compartida)
│   │       └── supabase.service.ts # Singleton del cliente Supabase
│   ├── shared/
│   │   ├── components/            # Badge, Btn, EmptyState, LoadingSpinner, Modal, Navbar
│   │   ├── models/                # Interfaces TypeScript 1:1 con tablas Supabase
│   │   └── pipes/                 # InicialesPipe, TiempoFormatoPipe
│   └── features/
│       ├── auth/pages/login/      # Login docente + acceso estudiante por código
│       ├── docente/
│       │   ├── services/          # GruposService, ExamenesService, SesionesService
│       │   └── pages/             # Grupos, Examenes, Monitor (WebRTC), Resultados
│       └── estudiante/
│           ├── services/          # ExamenActivoService (677 líneas — estado del examen)
│           └── pages/             # SalaEspera, Examen, ResultadoAlumno
├── environments/
│   ├── environment.ts             # Producción (anonKey hardcodeada — ver problemas)
│   └── environment.development.ts # Desarrollo
└── styles.css                     # Design tokens Tailwind v4 (@theme), paleta Blaze Orange
```
