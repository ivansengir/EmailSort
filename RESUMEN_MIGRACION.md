# ⚡ Resumen Rápido: Migración a Tu Supabase

## 🎯 Lo Que Necesitas Hacer (10 minutos)

### 1. Obtener Credenciales (2 min)
- Ve a: https://app.supabase.com
- Selecciona tu proyecto de Vercel
- Settings → API
- Copia: **Project URL** y **anon public key**

### 2. Actualizar `.env` (1 min)
Edita el archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

### 3. Ejecutar Migración (3 min)
- Abre: https://app.supabase.com
- SQL Editor → New query
- Copia TODO el contenido de `migration.sql`
- Pega y click "Run"
- Verifica que veas: "✓ Tabla X creada" (6 tablas)

### 4. Configurar Google OAuth (3 min)
**En Supabase**:
- Authentication → Providers → Google → Habilitar (toggle verde)
- Pega Client ID y Secret de Google Cloud

**En Google Cloud Console**:
- Actualiza Redirect URI a:
  ```
  https://TU-PROYECTO.supabase.co/auth/v1/callback
  ```

### 5. Probar (1 min)
```bash
npm run dev
```
- Intenta login con Google
- Crea una categoría de prueba
- ¡Listo! ✅

---

## 📁 Archivos Importantes

### 1. `.env` ← DEBES EDITAR ESTE
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_key_aqui
```

### 2. `migration.sql` ← EJECUTAR EN SUPABASE
Script SQL con todas las tablas, índices y políticas RLS

### 3. `src/lib/supabase.ts` ← YA ESTÁ BIEN
Ya lee del `.env`, no necesitas modificarlo

---

## ✅ Checklist Rápido

```
□ Obtuve URL de mi Supabase
□ Obtuve Anon Key de mi Supabase
□ Edité .env con mis credenciales
□ Ejecuté migration.sql en SQL Editor
□ Vi confirmación de 6 tablas creadas
□ Actualicé Redirect URI en Google Cloud
□ Habilité Google en mi Supabase
□ Configuré Client ID y Secret
□ Ejecuté npm run dev
□ Login funciona ✅
```

---

## 🔍 Cómo Verificar Que Todo Funciona

### Test 1: Conexión
```bash
npm run dev
```
Si abre sin errores → ✅

### Test 2: Login
- Click "Sign in with Google"
- Si abre popup → ✅
- Si redirige al dashboard → ✅

### Test 3: Base de Datos
- Crea una categoría
- Ve a Supabase → Table Editor → categories
- Si aparece la categoría → ✅

---

## 🆘 Errores Comunes

| Error | Solución |
|-------|----------|
| "Missing Supabase configuration" | Verifica `.env` tiene URL y Key |
| "Invalid API key" | Verifica que copiaste bien la Anon Key |
| "relation does not exist" | Ejecuta `migration.sql` de nuevo |
| "provider is not enabled" | Habilita Google en Supabase Dashboard |
| "Invalid redirect_uri" | Actualiza URI en Google Cloud |

---

## 📊 Antes vs Después

### ANTES:
```
.env:
VITE_SUPABASE_URL=https://apueveivuhhksykrzblu.supabase.co  ← Supabase de Bolt
VITE_SUPABASE_ANON_KEY=...                                   ← Key de Bolt
```

### DESPUÉS:
```
.env:
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co  ← TU Supabase
VITE_SUPABASE_ANON_KEY=...                        ← TU Key
```

### Redirect URI en Google Cloud

**ANTES**: `https://apueveivuhhksykrzblu.supabase.co/auth/v1/callback`

**DESPUÉS**: `https://TU-PROYECTO.supabase.co/auth/v1/callback`

---

## 💡 Importante

- ✅ NO necesitas modificar código
- ✅ Solo editas `.env` y ejecutas `migration.sql`
- ✅ El código ya está preparado para usar variables de entorno
- ✅ Todo funciona igual, solo cambia dónde se guardan los datos

---

## 🎯 Resultado Final

Después de la migración:

1. ✅ App usa TU Supabase de Vercel
2. ✅ Todos los datos se guardan en TU base de datos
3. ✅ 6 tablas creadas con RLS
4. ✅ Google OAuth configurado
5. ✅ App funciona idéntica
6. ✅ Control total de tus datos

---

## 📝 Para Referencia Rápida

### Dónde encontrar las credenciales:
```
Supabase Dashboard → Settings → API
├─ Project URL  → Copiar a .env como VITE_SUPABASE_URL
└─ anon public  → Copiar a .env como VITE_SUPABASE_ANON_KEY
```

### Dónde ejecutar el SQL:
```
Supabase Dashboard → SQL Editor → New query → Pegar migration.sql → Run
```

### Dónde habilitar Google:
```
Supabase Dashboard → Authentication → Providers → Google → Toggle ON
```

---

**Tiempo total estimado**: 10 minutos

**Documentación completa**: Ver `MIGRACION_VERCEL.md`

🚀 ¡Tu Supabase, tu control!
