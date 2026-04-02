# Runtime Fixes — Fase 2

> Fecha: 2026-04-02  
> Alcance: PeerJS ready-state, persistencia más segura del alumno y recovery post-refresh/resultados.

---

## Objetivo

Resolver tres puntos peligrosos detectados en `AUDIT_THIRD_PASS.md`:

1. race condition del `peerId` del alumno
2. pérdida de texto en preguntas abiertas por debounce
3. pantalla de resultados del alumno quedando cargando infinito

---

## Fixes aplicados

### 1. PeerJS ready-state endurecido

**Archivos:**
- `src/app/core/services/peer.service.ts`
- `src/app/features/estudiante/services/examen-activo.service.ts`
- `src/app/features/estudiante/pages/sala-espera/sala-espera.component.ts`

**Problema:**
- el alumno podía entrar al flujo de unión antes de que PeerJS terminara de asignar `peerId`
- eso dejaba `peer_id` vacío en BD y el monitor lo interpretaba como offline

**Qué se hizo:**
- se agregó `esperarPeerId(timeoutMs)` en `PeerService`
- `sala-espera.component.ts` ahora espera explícitamente el `peerId` antes de unirse
- si el `peerId` sigue sin llegar dentro del timeout inicial, se hace un patch en background cuando finalmente queda listo
- `ExamenActivoService` ahora expone `actualizarPeerId()` para persistir ese parche tardío

**Resultado:**
- el alumno ya no depende de una lectura prematura del `peerId`
- el monitor recibe correctamente el peer aunque la inicialización llegue tarde

---

### 2. Flush del debounce en preguntas abiertas

**Archivo:**
- `src/app/features/estudiante/pages/examen/components/pregunta-abierta/pregunta-abierta.component.ts`

**Problema:**
- si el alumno escribía y cambiaba rápido de pregunta, o enviaba enseguida, el texto podía no persistirse porque el debounce de 800ms no alcanzaba a ejecutar

**Qué se hizo:**
- flush explícito cuando cambia la pregunta
- flush explícito en `ngOnDestroy`

**Resultado:**
- baja muchísimo el riesgo de perder texto abierto por navegación rápida

---

### 3. Recovery de resultados con timeout y fallback real

**Archivo:**
- `src/app/features/estudiante/pages/resultado-alumno/resultado-alumno.component.ts`

**Problema:**
- el alumno podía quedar atrapado en “Cargando resultados...” para siempre

**Qué se hizo:**
- spinner real
- timeout de 10 segundos
- fallback visible con mensaje claro
- CTA para volver al inicio

**Resultado:**
- ya no existe loading infinito silencioso
- el alumno tiene salida clara si falla la recuperación

---

## Validación

Se verificó:

```bash
npx tsc --noEmit
ng serve --port 4402
```

Resultado:

- ✅ TypeScript sin errores
- ✅ Angular compila correctamente

---

## Riesgos / Follow-ups

### Aún pendientes

1. **Realtime + polling duplicados**
   - todavía no se atacó en esta fase

2. **Video expandido del monitor**
   - sigue pendiente revisar el caso de pantalla negra por timing de render

3. **Patch tardío del `peerId`**
   - si el alumno cierra la pestaña demasiado rápido, el parche posterior puede no llegar a ejecutarse

4. **Timeout fijo en resultados**
   - mejora mucho la UX, pero todavía es un timeout heurístico, no una resolución estructural total

---

## Archivos tocados en esta fase

- `src/app/core/services/peer.service.ts`
- `src/app/features/estudiante/services/examen-activo.service.ts`
- `src/app/features/estudiante/pages/sala-espera/sala-espera.component.ts`
- `src/app/features/estudiante/pages/examen/components/pregunta-abierta/pregunta-abierta.component.ts`
- `src/app/features/estudiante/pages/resultado-alumno/resultado-alumno.component.ts`

---

## Próxima fase sugerida

### Fase 3
1. coordinar Realtime + polling
2. revisar video expandido del monitor
3. endurecer recovery y consistencia del flujo alumno/docente en reconexiones
