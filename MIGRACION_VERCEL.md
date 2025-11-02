# 🚀 Migración a Tu Supabase de Vercel

## 📋 Resumen

Esta guía te ayudará a migrar la aplicación EmailSort AI a tu propio Supabase (el de Vercel) en lugar del Supabase de Bolt.

---

## ✅ PASO 1: Obtener las Credenciales de Tu Supabase

### 1.1 Ve a tu Supabase Dashboard

**Si tu Supabase está en Vercel**:
1. Ve a tu panel de Vercel
2. Encuentra tu proyecto de Supabase
3. Click en el proyecto para ver sus configuraciones

**O directamente en Supabase**:
1. Ve a: https://app.supabase.com
2. Selecciona tu proyecto

### 1.2 Obtén las Credenciales

En tu Supabase Dashboard:

1. Ve a **Settings** (⚙️) → **API**
2. Necesitas copiar 2 valores:

   **a) Project URL**:
   ```
   Ejemplo: https://tu-proyecto.supabase.co
   ```

   **b) API Key (anon, public)**:
   ```
   Ejemplo: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## ✅ PASO 2: Actualizar Variables de Entorno

### 2.1 Edita el archivo `.env`

Abre el archivo `.env` en la raíz del proyecto y reemplaza con tus valores:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anon_de_supabase
```

**Ejemplo**:
```env
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTQ2MTM2MDAsImV4cCI6MjAxMDE4OTYwMH0.ejemplo
```

### 2.2 Verifica que los cambios se guardaron

```bash
cat .env
```

Deberías ver tus nuevas credenciales.

---

## ✅ PASO 3: Ejecutar el Script de Migración

### 3.1 Ve a tu Supabase Dashboard

1. Abre: https://app.supabase.com
2. Selecciona tu proyecto
3. En el sidebar, busca **SQL Editor**
4. Click en **SQL Editor**

### 3.2 Ejecuta el Script de Migración

1. Abre el archivo `migration.sql` (está en la raíz del proyecto)
2. **COPIA TODO EL CONTENIDO** del archivo
3. En el SQL Editor de Supabase:
   - Click en **"New query"**
   - Pega todo el script
   - Click en **"Run"** o presiona `Ctrl+Enter`

### 3.3 Verifica que se crearon las tablas

Después de ejecutar el script, deberías ver:

```
✓ Tabla users creada
✓ Tabla gmail_accounts creada
✓ Tabla categories creada
✓ Tabla emails creada
✓ Tabla email_selections creada
✓ Tabla unsubscribe_logs creada
=== MIGRACIÓN COMPLETADA ===
```

### 3.4 Verifica las tablas en el Dashboard

1. Ve a **Table Editor** en el sidebar
2. Deberías ver todas las tablas:
   - users
   - gmail_accounts
   - categories
   - emails
   - email_selections
   - unsubscribe_logs

---

## ✅ PASO 4: Configurar Google OAuth

### 4.1 Ve a Authentication en Supabase

1. En tu Supabase Dashboard
2. Ve a **Authentication** → **Providers**
3. Busca **Google**
4. Habilita el toggle (debe quedar verde)

### 4.2 Actualiza el Redirect URI en Google Cloud

**IMPORTANTE**: El redirect URI cambió porque ahora usas TU Supabase.

1. Ve a: https://console.cloud.google.com/apis/credentials
2. Click en tu OAuth Client ID
3. En **Authorized redirect URIs**, reemplaza con:
   ```
   https://TU-PROYECTO.supabase.co/auth/v1/callback
   ```

   **Ejemplo**:
   ```
   https://abcdefgh.supabase.co/auth/v1/callback
   ```

4. Click **"Save"**

### 4.3 Configurar en Supabase

1. Vuelve a Supabase → Authentication → Providers → Google
2. Pega tu **Client ID** (de Google Cloud)
3. Pega tu **Client Secret** (de Google Cloud)
4. Click **"Save"**

---

## ✅ PASO 5: Probar la Aplicación

### 5.1 Reinicia la Aplicación

```bash
# Si está corriendo, presiona Ctrl+C para detenerla
# Luego inicia de nuevo:
npm run dev
```

### 5.2 Prueba el Login

1. Abre: http://localhost:5173
2. Click en "Sign in with Google"
3. Debería abrirse el popup de Google
4. Autoriza la aplicación
5. Deberías ver el dashboard

### 5.3 Prueba Crear una Categoría

1. En el dashboard, click "Add Category"
2. Nombre: "Test Category"
3. Descripción: "Testing migration"
4. Click "Create"
5. La categoría debería aparecer

### 5.4 Verifica en Supabase

1. Ve a Supabase Dashboard → Table Editor
2. Abre la tabla **users**
   - Debería haber 1 registro (tu usuario)
3. Abre la tabla **categories**
   - Debería aparecer la categoría que creaste

---

## 📁 Archivos Modificados

Los archivos que usarán las nuevas credenciales:

```
.env                           ← Variables de entorno actualizadas
src/lib/supabase.ts           ← Lee las variables de .env
migration.sql                 ← Script para crear tablas
```

**NO necesitas modificar ningún archivo de código**, solo `.env`.

---

## 🔍 Verificación Completa

### Checklist de Migración:

- [ ] Obtuve URL y Anon Key de mi Supabase
- [ ] Actualicé el archivo `.env` con mis credenciales
- [ ] Ejecuté `migration.sql` en SQL Editor de Supabase
- [ ] Vi los mensajes de confirmación de las tablas
- [ ] Verifiqué las tablas en Table Editor
- [ ] Actualicé el Redirect URI en Google Cloud Console
- [ ] Configuré Google OAuth en mi Supabase
- [ ] Reinicié la aplicación (`npm run dev`)
- [ ] Probé el login con Google
- [ ] Creé una categoría de prueba
- [ ] Verifiqué los datos en Supabase Dashboard

---

## 🐛 Solución de Problemas

### Error: "Invalid API key"

**Causa**: Las credenciales en `.env` son incorrectas

**Solución**:
1. Verifica que copiaste correctamente la URL y Anon Key
2. Asegúrate de que no haya espacios extra
3. Reinicia la app después de cambiar `.env`

### Error: "relation does not exist"

**Causa**: Las tablas no se crearon correctamente

**Solución**:
1. Ve a Supabase → SQL Editor
2. Ejecuta de nuevo el script `migration.sql`
3. Verifica que no haya errores en el output

### Error: "Invalid redirect_uri"

**Causa**: El redirect URI en Google Cloud no coincide

**Solución**:
1. Ve a Google Cloud Console → Credentials
2. Actualiza el redirect URI con TU URL de Supabase:
   ```
   https://TU-PROYECTO.supabase.co/auth/v1/callback
   ```

### Error: "Provider not enabled"

**Causa**: Google OAuth no está habilitado en tu Supabase

**Solución**:
1. Supabase → Authentication → Providers
2. Habilita Google (toggle verde)
3. Configura Client ID y Secret
4. Save

---

## 📊 Estructura de la Base de Datos

Después de la migración tendrás:

### Tablas:
- **users** - Perfiles de usuario
- **gmail_accounts** - Cuentas Gmail conectadas
- **categories** - Categorías de emails
- **emails** - Emails importados
- **email_selections** - Selecciones múltiples
- **unsubscribe_logs** - Logs de desuscripción

### Seguridad:
- ✅ RLS habilitado en todas las tablas
- ✅ Políticas restrictivas
- ✅ Solo los usuarios ven sus propios datos

### Índices:
- ✅ Índices en columnas frecuentes
- ✅ Optimizado para queries rápidas

---

## 🎯 Siguiente Paso

Una vez completada la migración:

1. ✅ Tu app usa TU Supabase de Vercel
2. ✅ Todas las tablas están creadas
3. ✅ RLS está configurado
4. ✅ Google OAuth funciona
5. ✅ Puedes empezar a usar la app

---

## 📝 Ejemplo de `.env` Final

Tu archivo `.env` debería verse así:

```env
VITE_SUPABASE_URL=https://tu-proyecto-real.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1LXByb3llY3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTQ2MTM2MDAsImV4cCI6MjAxMDE4OTYwMH0.tu_token_real
```

---

## ⚡ Comandos Rápidos

```bash
# 1. Verificar .env
cat .env

# 2. Reinstalar dependencias (opcional)
npm install

# 3. Ejecutar app
npm run dev

# 4. Build para producción
npm run build

# 5. Preview de producción
npm run preview
```

---

¡Listo! Tu aplicación ahora usa tu propio Supabase de Vercel. 🎉
