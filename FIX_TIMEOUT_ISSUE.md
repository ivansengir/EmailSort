# Solución al Problema de Timeouts de Sesión

## 🔍 Problema Identificado

La aplicación está experimentando timeouts constantes porque la consulta de usuario en la base de datos está tomando **11+ segundos**, pero el timeout estaba configurado en solo 5 segundos.

### Logs del Error
```
[getCurrentUser] DB select completed in 11033ms
Error: User lookup timed out (attempt 1/2)
Error: User lookup timed out (attempt 2/2)
```

## ✅ Cambios Aplicados

### 1. Aumento de Timeouts
- **Antes**: 5 segundos
- **Ahora**: 20 segundos
- **Razón**: La base de datos necesita más tiempo para responder

### 2. Mejora del Caché
- **Memoria Cache**: 15 minutos (antes 10 minutos)
- **localStorage Cache**: 15 minutos
- **Efecto**: Menos consultas a la base de datos

### 3. Reducción de Reintentos
- **Antes**: 2 intentos con timeout de 5s cada uno
- **Ahora**: 1 intento con timeout de 20s
- **Efecto**: Más rápido fallar/exitoso, menos carga en la DB

## 🚨 ACCIÓN REQUERIDA - CRÍTICO

**Debes ejecutar este SQL en Supabase para mejorar el rendimiento:**

### Paso 1: Abrir Supabase SQL Editor
1. Ve a tu proyecto en Supabase Dashboard
2. Click en "SQL Editor" en el menú lateral

### Paso 2: Ejecutar Script de Índice
Copia y pega este SQL:

```sql
-- Crear índice en auth_id para consultas ultrarrápidas
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- Actualizar estadísticas de la tabla
ANALYZE public.users;
```

### Paso 3: Verificar Índice
Ejecuta esta consulta para confirmar:

```sql
SELECT 
    indexname, 
    tablename, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'users';
```

Deberías ver `idx_users_auth_id` en los resultados.

## 📊 Mejora Esperada

### Antes del Índice
- Consulta de usuario: **11+ segundos** ⚠️
- Timeouts frecuentes
- Experiencia de usuario pobre

### Después del Índice
- Consulta de usuario: **< 100ms** ✅
- Sin timeouts
- Experiencia fluida

## 🔧 Por Qué Esto Funciona

### El Problema
La consulta `SELECT * FROM users WHERE auth_id = '...'` hace un **scan completo** de la tabla sin índice, lo cual es muy lento en Supabase.

### La Solución
El índice crea una estructura de búsqueda optimizada que permite encontrar el usuario instantáneamente por `auth_id`.

## ⚙️ Configuración Actual

```typescript
// auth.ts
const REQUEST_TIMEOUT_MS = 20000;        // 20 segundos
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutos

// Caché en memoria + localStorage
// Evita consultas innecesarias a la DB
```

## 🧪 Cómo Verificar la Mejora

### 1. Después de Ejecutar el SQL
```javascript
// En la consola del navegador deberías ver:
[getCurrentUser] DB select completed in <100ms  // ✅ RÁPIDO!
```

### 2. Sin Errores de Timeout
Ya no deberías ver:
```
Error: User lookup timed out
```

### 3. Sesión Estable
El cache de 15 minutos significa que solo consultará la DB:
- Al iniciar sesión
- Cada 15 minutos
- Al refrescar la página (si el cache expiró)

## 📝 Resumen de Archivos Modificados

1. **`src/lib/auth.ts`**
   - Timeout: 5s → 20s
   - Cache: 10min → 15min
   - Reintentos: 2 → 1 (con timeout más largo)

2. **`add_users_auth_id_index.sql`** (NUEVO)
   - Script para crear índice en la DB
   - **DEBES EJECUTAR ESTO EN SUPABASE**

## 🎯 Próximos Pasos

1. ✅ **CRÍTICO**: Ejecutar `add_users_auth_id_index.sql` en Supabase
2. ✅ Recargar la aplicación en el navegador
3. ✅ Verificar en consola que los tiempos de consulta sean < 100ms
4. ✅ Probar navegación entre páginas sin timeouts

## 💡 Nota Técnica

El índice es **esencial** porque:
- La tabla `users` usa `auth_id` como foreign key a `auth.users`
- Cada carga de página consulta el usuario por `auth_id`
- Sin índice = O(n) scan completo
- Con índice = O(log n) búsqueda binaria

**Rendimiento**: De 11 segundos a milisegundos ⚡
