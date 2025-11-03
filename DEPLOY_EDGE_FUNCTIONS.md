# Deploy Supabase Edge Functions

## Problema
La función Edge `import-emails` no está respondiendo, causando error CORS y ERR_FAILED.

## Solución: Redesplegar funciones Edge

### Opción 1: Usando Supabase CLI (Recomendado)

```bash
# 1. Instalar Supabase CLI (si no lo tienes)
npm install -g supabase

# 2. Login a Supabase
supabase login

# 3. Link al proyecto
supabase link --project-ref gutmosmrbvnidvdooqdt

# 4. Desplegar todas las funciones
supabase functions deploy

# O desplegar solo import-emails
supabase functions deploy import-emails
```

### Opción 2: Dashboard de Supabase

1. Ve a https://supabase.com/dashboard/project/gutmosmrbvnidvdooqdt
2. Click en "Edge Functions" en el menú lateral
3. Click en "Deploy new function"
4. Selecciona la carpeta `supabase/functions/import-emails`
5. Click "Deploy"

### Opción 3: GitHub Actions (Automático)

Si tienes configurado CI/CD, las funciones se desplegarán automáticamente en cada push.

## Variables de Entorno Requeridas

Asegúrate de que estas variables estén configuradas en Supabase Dashboard > Edge Functions > Secrets:

```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://gutmosmrbvnidvdooqdt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Verificar Despliegue

```bash
# Test con curl
curl -X POST https://gutmosmrbvnidvdooqdt.supabase.co/functions/v1/import-emails \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Logs

Para ver los logs de la función:

```bash
supabase functions logs import-emails --follow
```

O en el Dashboard:
1. Edge Functions > import-emails
2. Click en "Logs"
3. Ver errores en tiempo real
