# 📧 EmailSort AI

**Fully automated email management with AI-powered unsubscription**

Intelligent email classification and bulk action system with AI agent automation using OpenAI GPT-4 and Puppeteer for complex form interactions.

[![Deploy Status](https://img.shields.io/badge/deploy-render-46E3B7)](https://render.com)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

🌐 **Live Demo**: [https://emailsort-app.onrender.com](https://emailsort-app.onrender.com) *(deploy after following DEPLOYMENT.md)*

📦 **GitHub**: [Your Repo URL]

---

## ✨ Features

### 🤖 AI-Powered Unsubscription
- **Fully automated**: AI agent navigates pages, fills forms, clicks buttons
- **Smart detection**: OpenAI GPT-4o-mini extracts unsubscribe links from any language
- **Complex interactions**: Handles radio buttons, checkboxes, multi-step forms
- **Puppeteer automation**: Real browser for JavaScript-heavy pages (MediaMarkt, etc.)

### 📊 Email Management
- **Multi-account**: Connect multiple Gmail accounts
- **Smart categorization**: AI classifies emails with GPT-4.1-mini
- **Bulk actions**: Delete or unsubscribe from multiple emails at once
- **Custom categories**: Create and manage your own email categories

### 🔐 Secure & Private
- **Google OAuth**: Secure authentication with Gmail API access
- **Supabase backend**: Row-level security, encrypted storage
- **No data sharing**: Your emails never leave the system

---

## 🏗️ Architecture

```
Frontend (React+Vite)     →   Supabase Backend        →   MCP Server (Puppeteer)
├─ Auth (Google OAuth)        ├─ PostgreSQL                ├─ Headless Chrome
├─ Dashboard                  ├─ Edge Functions            ├─ Form automation
├─ Categories                 ├─ OpenAI Integration        └─ Screenshot capture
└─ Bulk Actions               └─ Gmail API sync
```

---

## 🚀 Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# Open http://localhost:5173

# Run tests
npm run test
```

---

## 🌐 Deployment (Production)

**Full deployment guide**: See [DEPLOYMENT.md](DEPLOYMENT.md)

### Option 1: Render.com (Recommended - Free Tier)

1. **Deploy MCP Server** (Puppeteer):
   - Create Web Service with Docker
   - Root directory: `mcp-server`
   - Copy URL

2. **Configure Supabase**:
   - Add `MCP_SERVER_URL` secret
   - Redeploy Edge Functions

3. **Deploy Frontend**:
   - Create Static Site
   - Build: `npm run build`
   - Publish: `dist`

**Detailed steps**: [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🔐 Environment Variables

### Frontend (`.env`)
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Edge Functions (Secrets)
```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
MCP_SERVER_URL=https://your-mcp-server.onrender.com
```

---

## 🏗️ Configuración Paso a Paso

1. **Supabase**
   - Ejecuta `migration.sql` en el SQL editor para crear tablas, índices, políticas y funciones RPC.
   - Habilita Google OAuth en `Authentication → Providers` con el client ID/secret de Google.
   - Crea un bucket de Edge Functions y despliega los scripts en `supabase/functions`:
     ```bash
     supabase functions deploy import-emails
     supabase functions deploy bulk-actions
     supabase functions deploy unsubscribe-email
     ```

2. **Google Cloud**
   - Crea un proyecto con Gmail API habilitada.
   - Configura OAuth consent screen (estado Testing) y agrega tus cuentas como *Test users*.
   - Crea credenciales OAuth 2.0 (tipo Web) con redirect: `https://<tu-proyecto>.supabase.co/auth/v1/callback` y `http://localhost:5173` para desarrollo.

3. **OpenAI**
   - Genera una API key con acceso a modelos Responses.
   - Asigna la clave como `OPENAI_API_KEY` en Edge Functions.

4. **Cron (pendiente)**
   - Configura un job en Supabase (o Vercel cron) que invoque `import-emails` cada 5-10 minutos para cada cuenta conectada. Temporalmente se ofrece botón “Sync now”.

---

## 🧱 Arquitectura

- **Frontend** (`src/`)
  - `context/AuthContext`: gestiona sesión Supabase y sincroniza la cuenta primaria de Gmail.
  - `pages/DashboardPage`: multi-inbox, creación de categorías, disparo manual de ingesta.
  - `pages/CategoryPage`: lista de emails, bulk actions, visor de correo (`EmailDetailModal`).
  - `lib/data`: capa de servicios sobre Supabase (hooks imperativos).
- **Edge Functions** (`supabase/functions`)
  - `import-emails`: refresca tokens, llama Gmail API, IA para categoría + resumen, inserta en BD y archiva en Gmail.
  - `bulk-actions`: maneja delete/unsubscribe, refrescando tokens y registrando logs.
  - `unsubscribe-email`: expone la lógica de desuscripción para casos individuales.
  - `_shared/openai`, `_shared/gmail`, `_shared/unsubscribe`, `_shared/util`: utilidades comunes.
- **Base de datos**
  - Tablas: `users`, `gmail_accounts`, `categories`, `emails`, `email_selections`, `unsubscribe_logs`.
  - Funciones RPC: `increment_category_email_count`, `toggle_email_selection`, `clear_email_selections_for_category`.
  - RLS para mantener los datos aislados por usuario.

---

## ✅ Funcionalidades Clave

| Módulo | Estado | Comentarios |
|--------|--------|-------------|
| Autenticación Google | ✅ | Supabase OAuth con scopes Gmail + tokens persistidos |
| Multicuenta Gmail | ✅ | Botón “Connect another account” reutiliza flujo OAuth |
| Ingesta autom. | ✅ | Edge function importa, clasifica, resume y archiva |
| Resúmenes IA | ✅ | GPT-4.1-mini genera resúmenes en 2 oraciones |
| Dashboard | ✅ | Sección cuentas + categorías con navegación |
| Vista categoría | ✅ | Selección múltiple, bulk delete/unsubscribe, visor completo |
| Desuscripción | ✅ | Heurística HTTP/mailto + logging en `unsubscribe_logs` |
| Selecciones | ✅ | RPC para persistir selección y limpiar por categoría |
| Pruebas unitarias | ✅ | Vitest + Testing Library con mocks de servicios |
| Cron/background | ⏳ | Pendiente configurar job recurrente |
| Documentación despliegue | ⏳ | Falta guía detallada Vercel/Supabase/OpenAI |

---

## 🧪 Pruebas

- `npm run test` ejecuta Vitest con entorno `jsdom` y asserts de Testing Library.
- Cobertura actual:
  - `DashboardPage`: renderizado de cuentas/categorías, creación de categorías y disparo de sync.
  - `CategoryPage`: carga de correos, selección y ejecución de bulk delete.
- Pendiente: Playwright (E2E) + unit tests para funciones Edge (mocking de Gmail/OpenAI).

---

## � Solución de Problemas Comunes

- **Login falla / popup cierra** → Verifica Client ID/Secret en Supabase y agrega el email como *Test user* en Google Cloud.
- **Sync de emails retorna 412 (No categories configured)** → Crea al menos una categoría con descripción para que la IA pueda clasificar.
- **import-emails responde 401** → Asegúrate de enviar el JWT de Supabase en la petición (el frontend lo hace automáticamente).
- **Errores de OpenAI** → Revisa logs de Edge Function e inspecciona si la clave tiene acceso al modelo `gpt-4.1-mini`.
- **Unsubscribe no concluye** → El agente intenta GET/HEAD; en sitios con formularios complejos devuelve estado `pending/manual`, revisar `unsubscribe_logs`.

---

## � Pendientes Importantes

- Configurar cron/scheduler para ingesta automática sin intervención manual.
- Documentar despliegue completo (Vercel + Supabase) y pipeline CI.
- Estrategia de pruebas para Edge Functions (mocks de Gmail API / OpenAI) + tests E2E.
- Localización/Accesibilidad: hoy la UI está en inglés con algunos textos en español.

---

## � Recursos

- `ESTADO_ACTUAL.md`: bitácora de progreso y próximos pasos.
- `TODO.md`: checklist vivo con tareas completadas y pendientes.
- `migration.sql`: estructura completa de BD + funciones.

---

**Desarrollado con React, TypeScript, Supabase y OpenAI.** 🚀
