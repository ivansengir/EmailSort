# Solución para Timeouts de Autenticación

## Problema
La aplicación está experimentando timeouts cuando intenta cargar los datos del usuario desde la base de datos, causando que te saque de la app con el error:
```
[getCurrentUser] Unexpected error: Error: User lookup timed out
```

## Soluciones Implementadas

### 1. ✅ Caché de Usuario (30 segundos)
- El usuario autenticado se guarda en caché por 30 segundos
- Evita queries repetitivas a Supabase
- Se limpia automáticamente al hacer logout

### 2. ✅ Timeout Aumentado (5s → 10s)
- Más tiempo para que las queries lentas completen
- Mejor para conexiones lentas o Supabase bajo carga

### 3. ✅ Manejo Robusto de Errores
- Si la query falla, la sesión se mantiene
- El usuario no es expulsado de la app
- Auto-reintento en la próxima navegación

### 4. ⚠️ Índices de Base de Datos (PENDIENTE)
Para mejorar aún más el rendimiento, **ejecuta este SQL en Supabase**:

#### Opción A: SQL Editor en Dashboard
1. Ve a https://supabase.com/dashboard/project/gutmosmrbvnidvdooqdt/sql/new
2. Copia y pega el contenido de `add_indexes.sql`
3. Haz clic en **Run**

#### Opción B: Desde la terminal local
```powershell
# Ejecutar el script SQL
npx supabase db execute --file add_indexes.sql
```

## Verificación

Después de aplicar los cambios:

1. **Recarga la aplicación**
2. **Abre la consola del navegador** (F12)
3. Busca estos mensajes:
   - `[getCurrentUser] Returning cached user` - ✅ Caché funcionando
   - `[getCurrentUser] DB select completed in Xms` - Verifica que sea < 1000ms

## Monitoreo

Si sigues viendo timeouts:

1. **Verifica la latencia a Supabase:**
   ```javascript
   // Pega esto en la consola del navegador
   const start = Date.now();
   await supabase.from('users').select('*').limit(1);
   console.log('Query took:', Date.now() - start, 'ms');
   ```

2. **Revisa los logs de Supabase:**
   - Dashboard → Logs → Database
   - Busca queries lentas (> 1s)

3. **Verifica el estado de Supabase:**
   - https://status.supabase.com/

## Limpieza Manual del Caché

Si necesitas forzar una recarga del usuario:

```javascript
// En la consola del navegador
import { clearUserCache } from './lib/auth';
clearUserCache();
window.location.reload();
```

## Mejoras Futuras (Opcional)

1. **Redis para caché persistente** (si los timeouts continúan)
2. **Service Worker** para cache offline
3. **Optimización de políticas RLS** (si son muy complejas)
4. **Connection pooling** en el lado del servidor
