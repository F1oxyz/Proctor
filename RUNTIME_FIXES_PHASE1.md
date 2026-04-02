# Runtime Fixes — Fase 1

> Fecha: 2026-04-02  
> Alcance: primer bloque de fixes críticos detectados en `AUDIT_THIRD_PASS.md`

---

## Objetivo

Bajar el riesgo funcional más peligroso del proyecto:

- falsa sensación de éxito al guardar/enviar examen
- navegación inválida del guard
- doble submit por temporizador
- botón fake en monitor

---

## Fixes aplicados

### 1. Persistencia visible para respuestas del alumno

**Archivo:**
- `src/app/features/estudiante/services/examen-activo.service.ts`
- `src/app/features/estudiante/pages/examen/examen.component.ts`

**Problema:**
- `guardarRespuesta()` fallaba silenciosamente
- el error iba solo a consola

**Qué se hizo:**
- se agregó `errorGuardado` como signal visible
- si falla guardar, ahora la UI puede mostrar banner de advertencia
- `reset()` limpia ese estado

**Resultado:**
- el alumno ya no queda completamente a ciegas si falla Supabase al guardar

---

### 2. `enviarExamen()` ya no aparenta éxito si falla

**Archivo:**
- `src/app/features/estudiante/services/examen-activo.service.ts`
- `src/app/features/estudiante/pages/examen/examen.component.ts`

**Problema:**
- el alumno podía terminar navegando a resultados aunque el envío hubiera fallado

**Qué se hizo:**
- `enviarExamen()` ahora retorna `null` en fallo
- el componente NO navega si el envío falla
- se muestra error visible
- aparece botón de **Reintentar envío**

**Resultado:**
- se eliminó la falsa sensación de entrega exitosa

---

### 3. `sessionGuard` blindado

**Archivo:**
- `src/app/core/guards/session.guard.ts`

**Problema:**
- podía mandar a `/examen/undefined`

**Qué se hizo:**
- validación explícita de `codigo`
- si no existe o viene como string `'undefined'`, fallback a `/`

**Resultado:**
- no más navegación basura por guard roto

---

### 4. Temporizador idempotente

**Archivo:**
- `src/app/features/estudiante/pages/examen/components/temporizador/temporizador.component.ts`

**Problema:**
- `tiempoAgotado` podía emitirse más de una vez

**Qué se hizo:**
- se agregó flag `yaEmitio`
- la emisión ahora es exactamente una vez por ciclo de vida del componente

**Resultado:**
- se evita doble submit al agotarse el tiempo

---

### 5. Botón fake `Avisar` sincerado

**Archivo:**
- `src/app/features/docente/pages/monitor/components/alumno-tile/alumno-tile.component.ts`
- `src/app/features/docente/pages/monitor/monitor.component.ts`

**Problema:**
- el botón no hacía nada real, solo `console.log`

**Qué se hizo:**
- ya no se presenta como acción real
- ahora muestra texto honesto: `Avisar (pronto)`
- el handler quedó como no-op documentado

**Resultado:**
- se removió una feature engañosa de la UI

---

## Validación

Se verificó:

```bash
npx tsc --noEmit
ng serve --port 4401
```

Resultado:

- ✅ TypeScript sin errores
- ✅ Angular compila correctamente

---

## Riesgos que todavía quedan

### Aún pendiente

1. **Race condition de PeerJS / `peerId`**
   - todavía no está resuelta en esta fase

2. **Guardado optimista**
   - si falla persistencia, la UI local puede seguir mostrando respuesta marcada aunque no esté sincronizada

3. **Tiempo agotado + reintento de envío**
   - el comportamiento ya no rompe, pero puede requerir mejor UX textual

---

## Próxima fase sugerida

### Fase 2
1. resolver ready-state de PeerJS
2. endurecer sincronización/persistencia del alumno
3. revisar fallback de resultados y recovery post-refresh

---

## Archivos tocados en esta fase

- `src/app/features/estudiante/services/examen-activo.service.ts`
- `src/app/features/estudiante/pages/examen/examen.component.ts`
- `src/app/core/guards/session.guard.ts`
- `src/app/features/estudiante/pages/examen/components/temporizador/temporizador.component.ts`
- `src/app/features/docente/pages/monitor/components/alumno-tile/alumno-tile.component.ts`
- `src/app/features/docente/pages/monitor/monitor.component.ts`
