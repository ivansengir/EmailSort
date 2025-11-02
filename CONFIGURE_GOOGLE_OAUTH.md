# Configurar Google OAuth para Edge Functions

Las Edge Functions necesitan las credenciales de Google OAuth para refrescar los tokens de acceso y leer los correos de Gmail.

## Paso 1: Obtener las credenciales

### Opción A: Desde Supabase Dashboard
1. Ve a tu proyecto: https://supabase.com/dashboard/project/gutmosmrbvnidvdooqdt
2. **Authentication** → **Providers** → **Google**
3. Copia el **Client ID** y **Client Secret** que configuraste

### Opción B: Desde Google Cloud Console
1. Ve a https://console.cloud.google.com/apis/credentials
2. Busca las credenciales OAuth 2.0 que creaste para Supabase
3. Copia el **Client ID** y **Client Secret**

## Paso 2: Configurar los secrets en Supabase

Ejecuta estos comandos en la terminal (reemplaza `YOUR_CLIENT_ID` y `YOUR_CLIENT_SECRET` con tus valores reales):

```powershell
# Configurar Client ID
npx supabase secrets set GOOGLE_OAUTH_CLIENT_ID=YOUR_CLIENT_ID

# Configurar Client Secret
npx supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET=YOUR_CLIENT_SECRET
```

## Paso 3: Verificar

Después de configurar los secrets, las funciones se reiniciarán automáticamente. Verifica que están configurados:

```powershell
npx supabase secrets list
```

Deberías ver `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET` en la lista.

## Paso 4: Probar la sincronización

Recarga la aplicación y prueba el botón "Sync now" nuevamente. Ahora debería funcionar correctamente.

---

## Notas importantes

- **NO** compartas estos valores en repositorios públicos
- Los secrets se aplican automáticamente a todas las Edge Functions
- Si cambias las credenciales en Google Cloud Console, debes actualizarlas aquí también
- Los tokens de refresh de Gmail se generan cuando el usuario se autentica con Google, pero para renovarlos necesitamos estas credenciales
