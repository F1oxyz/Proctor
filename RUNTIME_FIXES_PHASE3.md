# Runtime Fixes — Fase 3

> Fecha: 2026-04-02  
> Alcance: coordinación Realtime + polling, video expandido del monitor y cleanup de reconexión.

---

## Objetivo

Resolver tres problemas de runtime que seguían oliendo a vibecoding:

1. polling y Realtime corriendo juntos innecesariamente
2. video expandido del monitor quedando negro por timing de render
3. recursos y canales vivos después de salir del flujo del alumno

---

## Fixes aplicados

### 1. Realtime + polling coordinados

**Archivos:**
- `src/app/features/docente/services/sesiones.service.ts`
- `src/app/features/estudiante/services/examen-activo.service.ts`

**Problema:**
- el polling seguía ejecutándose aunque Realtime estuviera suscripto y funcionando
- eso duplicaba requests y abría la puerta a estados inconsistentes
- además `sincronizarManual()` podía disparar re-suscripciones innecesarias

**Qué se hizo:**
- cuando el canal entra en estado `SUBSCRIBED`, se detiene el polling
- si el canal falla (`CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`), el polling vuelve como fallback
- se agregó control con flags de `realtimeActivo`
- `iniciarMonitoreo()` ya no resuscribe si el canal ya está sano; hace solo refresh manual seguro

**Resultado:**
- menos duplicación
- menos ruido de red
- modelo más coherente: Realtime primero, polling como respaldo real

---

### 2. Video expandido del monitor ya no depende de un timing roto

**Archivo:**
- `src/app/features/docente/pages/monitor/monitor.component.ts`

**Problema:**
- al abrir pantalla completa, el `effect()` podía correr antes de que el `<video>` existiera en el DOM
- eso dejaba `srcObject` sin asignar y el video aparecía negro

**Qué se hizo:**
- se usa `afterNextRender` con el `Injector` del componente
- la asignación del stream ocurre después de que Angular renderiza el `<video>` real

**Resultado:**
- el stream se asigna cuando el elemento ya existe
- se corrige el caso del modal expandido en negro

---

### 3. Cleanup real del flujo del alumno al salir del shell

**Archivo:**
- `src/app/features/estudiante/pages/examen-shell.component.ts`

**Problema:**
- el `ExamenActivoService` quedaba con canales Realtime y polling vivos si el alumno abandonaba el flujo `/examen/:codigo/*`
- eso dejaba conexiones fantasma y posible leak de memoria/estado

**Qué se hizo:**
- se agregó `ngOnDestroy`
- el shell ahora llama `servicio.reset()` al destruirse

**Resultado:**
- se limpian canales, intervalos y estado reactivo al salir del flujo
- mejora reconexión y consistencia general

---

## Validación

Se verificó:

```bash
npx tsc --noEmit
ng serve --port 4403
```

Resultado:

- ✅ TypeScript sin errores
- ✅ Angular compila correctamente

---

## Riesgos / Follow-ups

### Pendientes todavía

1. **Supabase `CLOSED` puede venir tanto por error como por cierre intencional**
   - hoy el polling se reactiva como fallback; es seguro, pero todavía mejorable

2. **`afterNextRender` + `effect()`**
   - funciona bien acá, pero si en el futuro el flujo expandido se vuelve más complejo, conviene encapsular la lógica del video en un componente más dedicado

3. **No se atacó todavía toda la capa de recovery profundo**
   - especialmente escenarios multi-pestaña o pérdida de sessionStorage con estado parcial

---

## Archivos tocados en esta fase

- `src/app/features/docente/services/sesiones.service.ts`
- `src/app/features/estudiante/services/examen-activo.service.ts`
- `src/app/features/docente/pages/monitor/monitor.component.ts`
- `src/app/features/estudiante/pages/examen-shell.component.ts`

---

## Resultado acumulado

Con Fase 1 + Fase 2 + Fase 3 ya quedaron cubiertos los focos más pesados de vibecoding runtime:

- falsa entrega exitosa
- errores silenciosos de guardado
- guard roto
- doble submit del temporizador
- feature fake del monitor
- race condition de PeerJS
- pérdida de texto abierto por debounce
- loading infinito en resultados
- duplicación Realtime + polling
- video expandido negro
- cleanup deficiente al salir del flujo alumno

La base ya está MUCHO más seria.
