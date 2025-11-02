# Configurar OPENAI_API_KEY

Para que las Edge Functions funcionen, necesitas configurar tu API Key de OpenAI.

## Opción 1: Vía Supabase CLI

```bash
npx supabase secrets set OPENAI_API_KEY=sk-tu-clave-aqui
```

## Opción 2: Vía Dashboard de Supabase

1. Ve a https://supabase.com/dashboard/project/gutmosmrbvnidvdooqdt/settings/functions
2. Haz clic en "Edge Function Secrets"
3. Añade un nuevo secret:
   - Name: `OPENAI_API_KEY`
   - Value: tu clave de OpenAI (empieza con `sk-...`)

## Obtener tu OpenAI API Key

Si no tienes una:
1. Ve a https://platform.openai.com/api-keys
2. Crea una nueva API key
3. Cópiala (solo se muestra una vez)
4. Configúrala usando uno de los métodos anteriores

## Verificar

Una vez configurada, ejecuta:
```bash
npx supabase secrets list
```

Deberías ver `OPENAI_API_KEY` en la lista.

---

**IMPORTANTE**: Sin esta clave, las funciones de importación de emails fallarán porque necesitan OpenAI para categorizar y resumir los emails.
