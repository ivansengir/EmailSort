# Configuración del Sistema de Desuscripción Automatizado

## Arquitectura

```
┌──────────────────┐
│  Edge Function   │
│  (Supabase)      │
└────────┬─────────┘
         │
         │ HTTP POST /unsubscribe
         ▼
┌──────────────────┐
│   MCP Server     │
│  (Puppeteer)     │
└────────┬─────────┘
         │
         │ Browser automation
         ▼
┌──────────────────┐
│ Unsubscribe Page │
│  (MediaMarkt,    │
│   etc.)          │
└──────────────────┘
```

## Paso 1: Desplegar MCP Server

### Opción A: Railway.app (Recomendado)

1. Crear cuenta en [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Seleccionar este repositorio
4. Configurar:
   - **Root Directory**: `mcp-server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Port**: `3001` (Railway lo asigna automáticamente)

5. Esperar deployment (3-5 minutos)
6. Copiar la URL pública (ej: `https://emailsort-mcp-production.up.railway.app`)

### Opción B: Render.com

1. New → Web Service
2. Connect GitHub repository
3. Configurar:
   - **Root Directory**: `mcp-server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

4. Deploy
5. Copiar URL pública

### Opción C: VPS Manual

```bash
# En un servidor Ubuntu 22.04+
ssh user@your-server

# Instalar Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar dependencias de Chrome
sudo apt-get install -y \
  chromium-browser \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils

# Clonar repositorio
git clone <your-repo-url>
cd EmailSort/mcp-server

# Instalar dependencias
npm install
npm run build

# Instalar PM2 para mantener el proceso corriendo
sudo npm install -g pm2

# Iniciar servidor
pm2 start build/server.js --name emailsort-mcp

# Configurar para que inicie automáticamente
pm2 startup
pm2 save

# Verificar
curl http://localhost:3001/health
```

## Paso 2: Configurar Supabase Edge Function

1. Ir a Supabase Dashboard
2. Project Settings → Edge Functions → Secrets
3. Añadir nuevo secret:
   - **Name**: `MCP_SERVER_URL`
   - **Value**: URL de tu servidor MCP (ej: `https://emailsort-mcp-production.up.railway.app`)

4. Guardar

## Paso 3: Desplegar Edge Functions actualizadas

```bash
# En tu proyecto local
cd EmailSort

# Desplegar ambas funciones
npx supabase functions deploy unsubscribe-email --no-verify-jwt
npx supabase functions deploy bulk-actions --no-verify-jwt
```

## Paso 4: Probar el sistema

1. Ve a la aplicación
2. Selecciona el email de MediaMarkt (u otro con radio buttons)
3. Haz clic en "Unsubscribe"
4. Verifica en los logs:
   - Edge Function log: "🤖 Calling MCP server..."
   - MCP Server log: "Found 5 radio buttons, selecting first option..."
   - Resultado: `{ success: true, method: 'ai-auto', message: '...' }`

## Verificación del flujo completo

### 1. Check MCP Server Health

```bash
curl https://your-mcp-server.com/health
# Respuesta esperada: {"status":"ok","service":"emailsort-unsubscribe"}
```

### 2. Test directo del MCP Server

```bash
curl -X POST https://your-mcp-server.com/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{"url":"https://service-my.mediamarkt.es/pub/sf/FormLink?..."}'

# Respuesta esperada:
# {
#   "success": true,
#   "method": "ai-auto",
#   "message": "Selected radio button and submitted form successfully"
# }
```

### 3. Ver logs del MCP Server

**Railway:**
- Dashboard → Tu proyecto → Deployments → View Logs

**Render:**
- Dashboard → Tu servicio → Logs

**PM2 (VPS):**
```bash
pm2 logs emailsort-mcp
```

### 4. Ver logs de Edge Function

Supabase Dashboard → Functions → Edge Logs → Buscar "MCP server"

## Solución de problemas

### Error: "MCP_SERVER_URL not configured"

- Verifica que añadiste el secret en Supabase
- Redespliega las Edge Functions después de añadir el secret

### Error: "MCP server unavailable"

- Verifica que el servidor esté corriendo: `curl https://your-mcp-server.com/health`
- Revisa los logs del servidor para ver errores
- Verifica que la URL en MCP_SERVER_URL sea correcta (sin `/` al final)

### Error: "Timeout"

- El servidor tarda >45 segundos (límite configurado)
- Posibles causas:
  - Página muy lenta
  - CAPTCHA bloqueando navegación
  - Servidor MCP sobrecargado
- Solución: Aumentar timeout en `unsubscribe.ts` línea ~158

### El formulario no se envía correctamente

- Revisa logs del MCP Server para ver qué elementos detectó
- Verifica que el selector de botones incluya el texto correcto
- Puede que necesites ajustar los selectores en `server.ts`

## Costos estimados

### Railway.app
- **Hobby Plan**: $5/mes (500 horas de ejecución)
- **Pro Plan**: $20/mes (uso ilimitado)
- Estimación para uso bajo-medio: $5-10/mes

### Render.com
- **Free Tier**: Gratis (con limitaciones)
- **Starter**: $7/mes

### VPS (DigitalOcean/Hetzner)
- **Basic Droplet**: $4-6/mes (1GB RAM suficiente)
- Control total, mejor para escalabilidad

## Escalabilidad

El MCP Server puede manejar:
- **1 instancia**: ~5-10 desuscripciones simultáneas
- **Con load balancer**: 50+ simultáneas

Para mayor escala:
- Usar Railway Pro o múltiples instancias en Render
- Considerar cola de trabajos (BullMQ + Redis)

## Seguridad

- El MCP Server **no requiere autenticación** (solo accesible desde Edge Functions)
- Para producción, considera añadir:
  - API Key validation
  - Rate limiting
  - IP whitelisting (solo Supabase Edge Functions IPs)

## Siguiente paso

Una vez configurado todo, el sistema funcionará así:

1. Usuario selecciona email → Clic "Unsubscribe"
2. Edge Function extrae link con OpenAI
3. Edge Function analiza página con OpenAI
4. Si detecta formulario → Llama a MCP Server
5. MCP Server usa Puppeteer para:
   - Navegar a la página
   - Detectar radio buttons/checkboxes
   - Seleccionar primera opción
   - Hacer clic en "Enviar"
   - Verificar confirmación
6. Retorna resultado a Edge Function
7. Edge Function guarda en database
8. Usuario ve: ✅ Success / ⚠️ Manual required
