# Desplegar Supabase Edge Functions

## ✅ Estado Actual

- ✅ Supabase CLI instalado (vía npx)
- ✅ Autenticado en Supabase
- ✅ Proyecto vinculado (gutmosmrbvnidvdooqdt)
- ✅ Edge Functions desplegadas:
  - `import-emails`
  - `bulk-actions`
  - `unsubscribe-email`
- ⚠️ **PENDIENTE**: Configurar OPENAI_API_KEY (ver `CONFIGURE_OPENAI.md`)

## Próximos Pasos

1. **Configura tu OpenAI API Key** siguiendo las instrucciones en `CONFIGURE_OPENAI.md`
2. **Prueba la sincronización** en el dashboard haciendo clic en "Sync now"

## Comandos Útiles

1. Instalar Supabase CLI:
```bash
npm install -g supabase
```

2. Iniciar sesión en Supabase:
```bash
supabase login
```

3. Vincular el proyecto:
```bash
supabase link --project-ref gutmosmrbvnidvdooqdt
```

## Desplegar las Edge Functions

```bash
# Desplegar todas las funciones
supabase functions deploy import-emails
supabase functions deploy bulk-actions
supabase functions deploy unsubscribe-email
```

## Configurar Variables de Entorno en Supabase

Las Edge Functions necesitan estas variables (configurar en Supabase Dashboard → Edge Functions → Settings):

```bash
OPENAI_API_KEY=tu_clave_openai_aqui
SUPABASE_URL=https://gutmosmrbvnidvdooqdt.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

O configurarlas vía CLI:

```bash
supabase secrets set OPENAI_API_KEY=tu_clave
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=tu_service_key
```

## Verificar Despliegue

Una vez desplegadas, visita:
- https://gutmosmrbvnidvdooqdt.supabase.co/functions/v1/import-emails (debería responder con error de auth, no 404)

## Alternativa: Modo de Desarrollo Local

Para probar sin desplegar:

```bash
# Iniciar Supabase local
supabase start

# En otra terminal, servir las funciones
supabase functions serve
```

Luego actualiza `.env` con:
```
VITE_SUPABASE_URL=http://localhost:54321
```

---

**Nota**: Sin las Edge Functions desplegadas, las funcionalidades de sincronización de emails, bulk actions y unsubscribe no funcionarán.
