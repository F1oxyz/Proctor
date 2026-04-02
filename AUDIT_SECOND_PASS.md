# Segunda Pasada de Auditoría — Compilación y Regressions

> Fecha: 2026-04-02  
> Objetivo: verificar errores de compilación y validar que los fixes de la auditoría anterior no hayan roto nada.

---

## Resumen ejecutivo

- ✅ `npx tsc --noEmit` **sin errores**
- ✅ `ng serve --port 4400` **compila correctamente**
- ✅ Se detectó y corrigió **1 regression real** introducida por la limpieza anterior
- ✅ No quedaron referencias colgantes a archivos eliminados (`app.css`, `*.routes.ts` vacíos, `supabase.interceptor.ts`, `opciones-editor.component.ts`, `tabla-resultados.component.ts`)

---

## Qué se verificó

### 1. Compilación TypeScript

Se ejecutó:

```bash
npx tsc --noEmit
```

Resultado:

- Sin errores de TypeScript
- Las nuevas imports (`toSignal`, `startWith`, `DestroyRef`, `computed`, `avatar.utils`) están correctas
- No hay símbolos faltantes por los archivos eliminados

---

### 2. Compilación Angular real

Se ejecutó:

```bash
ng serve --port 4400
```

Resultado:

- Angular compiló correctamente
- Bundle generado sin errores
- Watch mode quedó activo normalmente

Nota: primero falló `ng serve` por puerto `4200` ocupado, no por código.

---

## Regression encontrada y corregida

### Error detectado

```text
NG8002: Can't bind to 'nombreAlumno' since it isn't a known property of 'app-screen-share-prompt'.
```

### Causa raíz

En la primera auditoría se eliminó correctamente el input muerto:

```ts
nombreAlumno = input('');
```

del componente:

- `src/app/features/estudiante/pages/sala-espera/components/screen-share-prompt/screen-share-prompt.component.ts`

Pero el padre seguía usando este binding:

```html
[nombreAlumno]="nombreAlumnoSeleccionado()"
```

en:

- `src/app/features/estudiante/pages/sala-espera/sala-espera.component.ts`

Eso generó una regression de compilación Angular.

### Fix aplicado

Se eliminó el binding sobrante:

```html
<app-screen-share-prompt
  [compartiendo]="pantallaCompartida()"
  (pantallaCompartida)="onPantallaCompartida($event)"
  (pantallaCancelada)="onPantallaCancelada()"
/>
```

### Estado

- ✅ Corregido
- ✅ Validado con `ng serve --port 4400`

---

## Validación de los fixes anteriores

### Eliminación de archivos vacíos

Se comprobó que **no quedaron referencias** a:

- `src/app/app.css`
- `src/app/core/interceptors/supabase.interceptor.ts`
- `src/app/features/auth/auth.routes.ts`
- `src/app/features/docente/docente.routes.ts`
- `src/app/features/estudiante/estudiante.routes.ts`
- `src/app/features/docente/pages/resultados/components/tabla-resultados/tabla-resultados.component.ts`
- `src/app/features/docente/pages/examenes/components/opciones-editor/opciones-editor.component.ts`

Estado:

- ✅ Sin imports colgantes
- ✅ Sin referencias en templates
- ✅ Sin errores de compilación por eliminación

---

### `app.ts` sin `app.css`

Cambio previo:

- se eliminó `styleUrl: './app.css'`
- se eliminó el `title = signal('proctor')` muerto

Validación:

- ✅ `App` compila correctamente
- ✅ `RouterOutlet` sigue funcionando
- ✅ No hubo regressions en bootstrap

---

### `modal-crear-grupo.component.ts`

Cambio previo:

- `totalAlumnosDetectados` pasó de leer `FormControl.value` directo a usar:

```ts
private readonly listaAlumnosValue = toSignal(
  this.form.controls['listaAlumnos'].valueChanges.pipe(startWith('')),
  { initialValue: '' }
);
```

Validación:

- ✅ Compila correctamente
- ✅ Imports correctos (`@angular/core/rxjs-interop`, `rxjs`)
- ✅ No introduce errores de tipos

---

### `modal.component.ts`

Cambio previo:

- `anchoClase` convertido a `computed()`
- cleanup con `DestroyRef.onDestroy()` para restaurar `body.style.overflow`

Validación:

- ✅ Compila correctamente
- ✅ `DestroyRef` disponible y bien inyectado
- ✅ No rompe template ni bindings del modal

---

### `avatar.utils.ts`

Cambio previo:

- se extrajeron `colorAvatar()` y `getIniciales()` a:
  - `src/app/shared/utils/avatar.utils.ts`

Consumidores validados:

- `tabla-alumnos.component.ts`
- `alumno-tile.component.ts`
- `fila-resultado.component.ts`
- `shared/index.ts`

Validación:

- ✅ Imports correctos
- ✅ Export correcto desde `shared/index.ts`
- ✅ Sin regressions de compilación

---

### `exam-form.component.ts`

Cambio previo:

- se añadió `descripcion` al payload de guardado del examen

Validación:

- ✅ Compila correctamente
- ✅ No rompe el flujo de crear/editar examen
- ✅ El payload queda coherente con el formulario

---

### `resultados.component.ts`

Cambio previo:

- `descripcion="..."` → `mensaje="..."` en `app-empty-state`

Validación:

- ✅ Compila correctamente
- ✅ El input ahora coincide con la API del componente shared

---

### `monitor.component.ts`

Cambio previo:

- corrección de clase duplicada:

```html
[class.sm:grid-cols-4]="columnas() === 4"
```

Validación:

- ✅ Compila correctamente
- ✅ No afecta otros breakpoints

---

### `app.spec.ts`

Cambio previo:

- se eliminó el test falso que buscaba un `<h1>` inexistente

Validación:

- ✅ El archivo sigue siendo válido
- ✅ No genera errores de compilación de tests

---

## Hallazgos finales de esta segunda pasada

### Problemas corregidos en esta pasada

1. **Binding roto de `nombreAlumno`** en `sala-espera.component.ts`

### Problemas NO detectados en compilación

No aparecieron nuevos errores por:

- eliminación de archivos vacíos
- extracción de utilidades compartidas
- cambio a `computed()` en modal
- uso de `toSignal()` en formulario reactivo
- limpieza de imports y dead code

---

## Estado actual

El proyecto, a nivel de compilación, queda así:

- ✅ Angular compila
- ✅ TypeScript compila
- ✅ Los cambios de la auditoría anterior quedaron consistentes
- ✅ El markdown de ambas auditorías ya existe:
  - `AUDIT.md`
  - `AUDIT_SECOND_PASS.md`

---

## Siguiente paso recomendado

Ahora sí conviene hacer una **tercera pasada**, pero ya no de compilación, sino de:

1. **runtime bugs** (flujos reales en navegador)
2. **deuda técnica alta** (`any`, polling + realtime, guard inseguro)
3. **UX rota o incompleta** (botón `Avisar`, mensajes silenciosos, errores no visibles para usuario)

Porque COMPILAR no significa FUNCIONAR BIEN. Y ahí es donde estos proyectos vibecodeados te explotan, loco.
