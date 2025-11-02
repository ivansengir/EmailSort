# Cómo Agregar Múltiples Cuentas de Gmail

## Limitación Actual

Actualmente, **EmailSort vincula una cuenta de Gmail por cada cuenta de Google** que uses para autenticarte. Esto se debe a cómo funciona Supabase Auth.

## Cómo Funciona Ahora

- **1 Google Account** = **1 Usuario en EmailSort** = **1 Cuenta de Gmail**
- Cuando te autentícas con `usuario1@gmail.com`, ves solo los emails de `usuario1@gmail.com`
- Si cierras sesión y te autentícas con `usuario2@gmail.com`, creas un nuevo usuario separado

## Opción 1: Usar Múltiples Navegadores/Perfiles (Actual)

Para gestionar múltiples cuentas de Gmail separadamente:

1. **Perfil de Chrome 1**: Autentícate con `cuenta1@gmail.com`
2. **Perfil de Chrome 2**: Autentícate con `cuenta2@gmail.com`  
3. **Navegador Privado**: Autentícate con `cuenta3@gmail.com`

Cada sesión es independiente y gestiona su propia cuenta de Gmail.

## Opción 2: Implementar OAuth Manual (Futuro)

Para permitir que un usuario agregue múltiples cuentas de Gmail, necesitamos:

### Cambios Requeridos:

1. **Nueva Edge Function**: `add-gmail-account`
   - Genera URL de OAuth con Google
   - Intercambia authorization code por tokens
   - Guarda tokens en `gmail_accounts` sin cambiar la sesión actual

2. **Popup OAuth**:
   - Abrir ventana popup para OAuth
   - Usuario autoriza cuenta adicional
   - Capturar tokens y cerrar popup
   - Actualizar lista de cuentas

3. **Frontend**:
   - Botón "Add Gmail Account" abre popup
   - Lista muestra todas las cuentas del usuario
   - Cada cuenta tiene su propio botón "Sync"

### Flujo Propuesto:

```typescript
// 1. Usuario hace clic en "Add Account"
async function handleAddGmailAccount() {
  // 2. Backend genera URL de OAuth
  const { oauthUrl } = await supabase.functions.invoke('get-gmail-oauth-url');
  
  // 3. Abrir popup
  const popup = window.open(oauthUrl, 'gmail-auth', 'width=600,height=600');
  
  // 4. Esperar mensaje del popup con el código
  window.addEventListener('message', async (event) => {
    if (event.data.type === 'gmail-auth-success') {
      const { code } = event.data;
      
      // 5. Backend intercambia código por tokens y los guarda
      await supabase.functions.invoke('add-gmail-account', {
        body: { code }
      });
      
      // 6. Recargar lista de cuentas
      await loadAccounts();
    }
  });
}
```

### Variables de Entorno Necesarias:

```env
# Ya configuradas:
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# Nuevas necesarias:
VITE_GOOGLE_CLIENT_ID=<tu-client-id>
GOOGLE_OAUTH_CLIENT_SECRET=<tu-client-secret> # Solo en Edge Functions
```

## Opción 3: Usar Service Accounts de Google (Empresarial)

Para organizaciones con Google Workspace, se puede:
1. Crear un Service Account
2. Delegar acceso a múltiples buzones
3. Usar una sola autenticación para acceder a todos

Requiere Google Workspace y configuración de Domain-Wide Delegation.

## Estado Actual

✅ **Implementado**:
- Un usuario puede gestionar una cuenta de Gmail
- Puede cerrar sesión y cambiar a otra cuenta de Google
- Cada cuenta de Google mantiene su historial separado

⏳ **Pendiente**:
- Múltiples cuentas de Gmail para un mismo usuario de Google
- Requiere implementar OAuth manual fuera de Supabase Auth

## ¿Necesitas Esta Funcionalidad?

Si necesitas gestionar múltiples cuentas de Gmail urgentemente:

**Opción rápida**: Usa perfiles de navegador separados

**Opción robusta**: Puedo implementar el sistema de OAuth manual descrito arriba, pero requiere:
- Aproximadamente 2-3 horas de desarrollo
- Configurar variables de entorno adicionales  
- Crear 2 nuevas Edge Functions
- Modificar el frontend para manejar popups

¿Quieres que implemente esto?
