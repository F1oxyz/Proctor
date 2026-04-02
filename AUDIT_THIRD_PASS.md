# Tercera Pasada de Auditoría — Runtime, Flujos Reales y Vibecoding

> Fecha: 2026-04-02  
> Objetivo: auditar comportamiento real de la app en runtime, errores silenciosos, race conditions, UX rota y flujos falsos.

---

## Resumen ejecutivo

Esta tercera pasada se enfocó en lo que **compila pero puede FALLAR en uso real**.

### Resultado general

- 🔴 **7 problemas críticos**
- 🟠 **9 problemas altos**
- 🟡 **7 problemas medios**

### Conclusión fuerte

El hallazgo más grave es la combinación de estos dos bugs:

1. **el alumno puede navegar al resultado aunque el envío haya fallado**, y
2. **las respuestas pueden fallar al persistirse sin mostrar error real**.

Eso significa que el sistema puede dar una **sensación falsa de entrega exitosa**.

---

## Flujos auditados

### Docente
- login
- ver exámenes
- crear examen
- editar examen
- iniciar sesión de examen
- monitor en vivo
- resultados

### Estudiante
- entrar con código
- elegir alumno
- compartir pantalla
- sala de espera
- iniciar examen
- responder preguntas
- enviar examen
- ver resultado

---

## 🔴 Problemas CRÍTICOS

### C-1. `enviarExamen()` navega al resultado aunque Supabase falle

- **Archivo**: `src/app/features/estudiante/services/examen-activo.service.ts`
- **Causa**: el flujo puede continuar hacia la pantalla de resultado aunque el update final o persistencia falle.
- **Impacto**: el alumno cree que entregó; el docente puede no ver el examen enviado.
- **Riesgo**: pérdida funcional del examen con falso positivo de éxito.
- **Fix sugerido**:
  - bloquear navegación al resultado si falla persistencia
  - setear `this.error`
  - mostrar feedback visible al alumno

---

### C-2. Race condition con PeerJS: `peerId` queda vacío cuando se llama `unirseASala()`

- **Archivo**: flujo entre `sala-espera.component.ts`, `peer.service.ts`, `examen-activo.service.ts`
- **Causa**: el alumno puede unirse antes de que PeerJS termine de inicializar.
- **Impacto**: el monitor muestra al alumno como desconectado/offline aunque sí esté compartiendo pantalla.
- **Fix sugerido**:
  - esperar explícitamente a que PeerJS esté listo antes de llamar `unirseASala()`
  - o reintentar patch del `peer_id` cuando el peer quede disponible

---

### C-3. `sessionGuard` puede navegar a `/examen/undefined`

- **Archivo**: `src/app/core/guards/session.guard.ts`
- **Causa**: asume que `route.parent?.params['codigo']` siempre existe.
- **Impacto**: fallback roto, navegación inválida, UX confusa.
- **Fix sugerido**:
  - null-check real
  - fallback a `/` o a `/examen`

---

### C-4. `TemporizadorComponent` puede emitir `tiempoAgotado` dos veces

- **Archivo**: `src/app/features/estudiante/pages/examen/components/temporizador/temporizador.component.ts`
- **Causa**: el effect no garantiza emisión única al llegar a 0.
- **Impacto**: doble submit / doble update en paralelo.
- **Fix sugerido**:
  - agregar guard tipo `yaEmitido`
  - asegurar emisión exactly-once

---

### C-5. `guardarRespuesta()` falla silenciosamente

- **Archivo**: `src/app/features/estudiante/services/examen-activo.service.ts`
- **Causa**: si Supabase falla, la respuesta queda en memoria local y el error no sube a UI.
- **Impacto**: al refrescar o cambiar de contexto, se pierden respuestas sin que el alumno lo note.
- **Fix sugerido**:
  - propagar el error a un signal visible
  - mostrar estado de guardado / error en la UI
  - idealmente reintentos o cola local

---

### C-6. Botón `Avisar` del monitor es fake

- **Archivo**: `src/app/features/docente/pages/monitor/monitor.component.ts`
- **Causa**: solo hace `console.log`.
- **Impacto**: feature falsa expuesta en producción.
- **Fix sugerido**:
  - ocultarlo o deshabilitarlo hasta implementarlo
  - o implementar mensaje real vía Realtime / Supabase

---

### C-7. `actualizarExamen()` puede borrar respuestas históricas

- **Archivo**: `src/app/features/docente/services/examenes.service.ts`
- **Causa**: al editar examen se borran entidades relacionadas de manera riesgosa.
- **Impacto**: pérdida irreversible de historial de sesiones finalizadas.
- **Fix sugerido**:
  - no permitir editar exámenes con historial activo/finalizado
  - o versionar examen en vez de mutarlo destructivamente

---

## 🟠 Problemas ALTOS

### A-1. Realtime + Polling + sincronización manual duplican trabajo y suscripciones

- **Archivos**:
  - `src/app/features/docente/services/sesiones.service.ts`
  - `src/app/features/estudiante/services/examen-activo.service.ts`
  - `src/app/features/docente/pages/monitor/monitor.component.ts`
- **Impacto**: requests redundantes, más probabilidad de estados inconsistentes.
- **Fix sugerido**: cancelar polling cuando Realtime esté `SUBSCRIBED` y evitar resuscripciones duplicadas.

---

### A-2. Preguntas abiertas pueden perder texto por debounce de 800ms

- **Archivo**: `src/app/features/estudiante/pages/examen/components/pregunta-abierta/pregunta-abierta.component.ts`
- **Causa**: si el alumno cambia de pregunta o navega muy rápido, el debounce no se flushea.
- **Impacto**: pérdida de texto que el alumno cree haber escrito.
- **Fix sugerido**:
  - flush en blur / onDestroy / cambio de pregunta

---

### A-3. Video expandido del monitor puede quedar negro

- **Archivo**: `src/app/features/docente/pages/monitor/monitor.component.ts`
- **Causa**: el `effect` puede correr antes de que el `<video>` exista por el `@if`.
- **Impacto**: pantalla completa sin stream visible.
- **Fix sugerido**:
  - reaccionar al `viewChild` ya renderizado
  - o usar `afterNextRender`

---

### A-4. Resultado del alumno puede quedar cargando infinito

- **Archivo**: `src/app/features/estudiante/pages/resultado-alumno/resultado-alumno.component.ts`
- **Impacto**: usuario atrapado sin feedback útil.
- **Fix sugerido**:
  - timeout/fallback visible
  - mensaje de error y CTA para reintentar

---

### A-5. Error de navegación puede verse como error de credenciales

- **Archivo**: flujo auth docente
- **Impacto**: debugging y UX confusos.
- **Fix sugerido**:
  - separar errores de auth de errores de router

---

### A-6. `descripcion` del examen sigue siendo sospechosa en persistencia real

- **Archivo**: `exam-form.component.ts` + capa de servicio / modelo / BD
- **Causa**: el form ya la envía, pero hay que confirmar que la capa de persistencia realmente la soporte end-to-end.
- **Impacto**: campo potencialmente fake si la tabla o el servicio no lo guardan.
- **Fix sugerido**:
  - validar select/insert/update completos
  - validar carga al editar

---

### A-7. Errores críticos van a consola sin feedback de UI

- **Archivos**: múltiples servicios (`peer`, `examen-activo`, `resultados`, etc.)
- **Impacto**: usuario no entiende qué pasó; soporte y debugging se vuelven infernales.
- **Fix sugerido**:
  - estrategia común de manejo de error visible

---

### A-8. Estados visuales del monitor no representan estados reales completos

- **Archivo**: `alumno-tile.component.ts`
- **Impacto**: `idle` y `flagged` no aparecen realmente aunque la UI parezca soportarlos.
- **Fix sugerido**:
  - o implementarlos de verdad
  - o sacar esos estados del diseño hasta tener lógica real

---

### A-9. Recovery/fallbacks demasiado frágiles en flujos de estudiante

- **Archivo**: servicios y páginas del flujo estudiante
- **Impacto**: recargas, pérdidas parciales de estado y navegación inválida.
- **Fix sugerido**:
  - endurecer recuperación desde sessionStorage + BD
  - desacoplar más claramente estado local vs persistido

---

## 🟡 Problemas MEDIOS

### M-1. `idle` y `flagged` nunca se asignan realmente
- **Archivo**: `alumno-tile.component.ts`

### M-2. El monitor y el cierre manual comparten zonas con race condition
- **Archivo**: `monitor.component.ts`

### M-3. `descripcion` puede no cargarse correctamente al editar
- **Archivo**: flujo crear/editar examen

### M-4. Hay recovery duplicado y parcialmente redundante en resultados del alumno
- **Archivo**: `examen-activo.service.ts`

### M-5. Persistencia y estado visual no están alineados en varios pasos del alumno
- **Archivo**: flujo examen activo

### M-6. Errores de PeerJS no críticos no distinguen bien severidad técnica vs UX
- **Archivo**: `peer.service.ts`, `sala-espera.component.ts`

### M-7. Botones y affordances de UX prometen más de lo que realmente implementan
- **Archivo**: varias pantallas de docente/monitor

---

## Fixes pequeños recomendados para aplicar YA

### FIX-1. Blindar `sessionGuard`

- validar `codigo` real antes de navegar
- no mandar nunca a `/examen/undefined`

### FIX-2. Hacer `tiempoAgotado` idempotente

- una sola emisión posible

### FIX-3. Mostrar feedback real cuando falle persistencia de respuestas o envío

- no solo consola
- no navegar si el envío no terminó bien

### FIX-4. Deshabilitar u ocultar `Avisar` hasta implementarlo

- no vender una feature fake

---

## Prioridad recomendada de trabajo

### Fase 1 — urgente
1. C-1 `enviarExamen()` no debe navegar si falla
2. C-5 `guardarRespuesta()` debe mostrar error real
3. C-4 doble emisión del temporizador
4. C-3 `sessionGuard` con fallback seguro

### Fase 2 — muy importante
5. C-2 PeerJS ready / peerId race
6. C-6 botón `Avisar`
7. A-1 Realtime + Polling duplicados
8. A-2 flush del debounce en preguntas abiertas

### Fase 3 — endurecimiento estructural
9. C-7 edición de examen sin destruir historial
10. A-4/A-9 recuperación robusta del flujo alumno
11. A-8 / M-1 sincerar estados del monitor

---

## Conclusión final

La app ya **compila**, sí. Pero todavía hay varios puntos donde el vibecoding se nota clarísimo:

- estados que aparentan existir pero no están implementados
- botones fake
- errores silenciosos
- race conditions en tiempo real
- persistencia que puede fallar sin avisar

En otras palabras: la estructura ya no está tan rota, pero todavía hay **riesgo funcional serio** en producción.

El siguiente movimiento inteligente es abrir una tanda de fixes empezando por:

1. `enviarExamen()` / `guardarRespuesta()`
2. `sessionGuard`
3. `TemporizadorComponent`
4. PeerJS ready-state

Eso te baja el riesgo real de pérdida de examen, que hoy es el problema más peligroso.
