import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface CheckResult {
  name: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

export function DebugPage() {
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    runDiagnostics();
  }, []);

  async function runDiagnostics() {
    setIsChecking(true);
    const results: CheckResult[] = [];

    // Check 1: Environment Variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      results.push({
        name: 'Variables de Entorno',
        status: 'success',
        message: 'Variables configuradas correctamente',
        details: `URL: ${supabaseUrl}`,
      });
    } else {
      results.push({
        name: 'Variables de Entorno',
        status: 'error',
        message: 'Variables de entorno faltantes',
        details: `URL: ${supabaseUrl || 'FALTA'}, Key: ${supabaseKey ? 'OK' : 'FALTA'}`,
      });
    }

    // Check 2: Supabase Connection
    try {
      const { data, error } = await supabase.from('users').select('count').limit(1);

      if (error) {
        results.push({
          name: 'Conexión a Supabase',
          status: 'error',
          message: 'Error al conectar con Supabase',
          details: error.message,
        });
      } else {
        results.push({
          name: 'Conexión a Supabase',
          status: 'success',
          message: 'Conexión exitosa a la base de datos',
        });
      }
    } catch (error) {
      results.push({
        name: 'Conexión a Supabase',
        status: 'error',
        message: 'Error de red',
        details: error instanceof Error ? error.message : 'Error desconocido',
      });
    }

    // Check 3: Auth Configuration
    try {
      const { data: { session } } = await supabase.auth.getSession();

      results.push({
        name: 'Sesión de Autenticación',
        status: session ? 'success' : 'warning',
        message: session ? 'Hay una sesión activa' : 'No hay sesión activa',
        details: session ? `User: ${session.user.email}` : 'Haz login para crear una sesión',
      });
    } catch (error) {
      results.push({
        name: 'Sesión de Autenticación',
        status: 'error',
        message: 'Error al verificar sesión',
        details: error instanceof Error ? error.message : 'Error desconocido',
      });
    }

    // Check 4: Google OAuth Provider
    results.push({
      name: 'Google OAuth',
      status: 'warning',
      message: 'Verifica manualmente en Supabase Dashboard',
      details: 'Ve a Authentication → Providers → Google debe estar habilitado',
    });

    setChecks(results);
    setIsChecking(false);
  }

  async function testGoogleLogin() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify',
        },
      });

      if (error) {
        alert(`Error al iniciar sesión: ${error.message}`);
      } else {
        console.log('OAuth iniciado:', data);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  function getIcon(status: string) {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-6 h-6 text-yellow-600" />;
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔧 Diagnóstico de EmailSort AI
          </h1>
          <p className="text-gray-600 mb-4">
            Herramienta de depuración para verificar la configuración
          </p>

          <div className="flex gap-3">
            <button
              onClick={runDiagnostics}
              disabled={isChecking}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium"
            >
              {isChecking ? 'Verificando...' : 'Ejecutar Diagnóstico'}
            </button>

            <button
              onClick={testGoogleLogin}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
            >
              Probar Login con Google
            </button>

            <a
              href="/auth"
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
            >
              Ir a Login
            </a>
          </div>
        </div>

        <div className="space-y-4">
          {checks.map((check, index) => (
            <div
              key={index}
              className={`bg-white rounded-lg shadow p-6 border-l-4 ${
                check.status === 'success'
                  ? 'border-green-500'
                  : check.status === 'error'
                  ? 'border-red-500'
                  : 'border-yellow-500'
              }`}
            >
              <div className="flex items-start gap-4">
                {getIcon(check.status)}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {check.name}
                  </h3>
                  <p className="text-gray-700 mb-2">{check.message}</p>
                  {check.details && (
                    <pre className="text-sm text-gray-600 bg-gray-50 p-3 rounded overflow-x-auto">
                      {check.details}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-blue-900 mb-4">
            📋 Checklist de Configuración de Google OAuth
          </h2>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" />
              <div>
                <strong>Google Cloud Console:</strong>
                <ul className="list-disc list-inside text-sm text-gray-700 ml-4 mt-1">
                  <li>Proyecto creado o seleccionado</li>
                  <li>OAuth 2.0 Client ID creado (tipo: Web application)</li>
                  <li>Authorized redirect URIs incluye: <code className="bg-white px-1 rounded">https://gutmosmrbvnidvdooqdt.supabase.co/auth/v1/callback</code></li>
                  <li>Para localhost: <code className="bg-white px-1 rounded">http://localhost:5173</code></li>
                  <li>Client ID y Client Secret copiados</li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" />
              <div>
                <strong>Supabase Dashboard:</strong>
                <ul className="list-disc list-inside text-sm text-gray-700 ml-4 mt-1">
                  <li>Authentication → Providers → Google está habilitado (toggle en verde)</li>
                  <li>Client ID pegado desde Google Cloud</li>
                  <li>Client Secret pegado desde Google Cloud</li>
                  <li>Cambios guardados</li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" />
              <div>
                <strong>OAuth Consent Screen (Google Cloud):</strong>
                <ul className="list-disc list-inside text-sm text-gray-700 ml-4 mt-1">
                  <li>Pantalla de consentimiento configurada</li>
                  <li>Tu email agregado en "Test users"</li>
                  <li>Estado: "Testing" o "Production"</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-bold text-yellow-900 mb-2">⚠️ Errores Comunes</h3>

          <div className="space-y-2 text-sm text-gray-700">
            <div>
              <strong>Error: "Invalid redirect_uri"</strong>
              <p className="ml-4">→ Verifica que el redirect URI en Google Cloud Console sea exactamente: <code className="bg-white px-1 rounded">https://gutmosmrbvnidvdooqdt.supabase.co/auth/v1/callback</code></p>
            </div>

            <div>
              <strong>Error: "Access blocked"</strong>
              <p className="ml-4">→ Agrega tu email en "Test users" en OAuth consent screen</p>
            </div>

            <div>
              <strong>Error: "Provider not enabled"</strong>
              <p className="ml-4">→ En Supabase Dashboard, verifica que Google esté habilitado (toggle verde)</p>
            </div>

            <div>
              <strong>Popup se cierra inmediatamente</strong>
              <p className="ml-4">→ Revisa la consola del navegador (F12) para ver el error exacto</p>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="font-bold text-gray-900 mb-4">🔗 Links Útiles</h3>

          <div className="space-y-2">
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-blue-600 hover:text-blue-800 underline"
            >
              → Google Cloud Console - Credentials
            </a>
            <a
              href="https://app.supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-blue-600 hover:text-blue-800 underline"
            >
              → Supabase Dashboard
            </a>
            <a
              href="https://supabase.com/docs/guides/auth/social-login/auth-google"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-blue-600 hover:text-blue-800 underline"
            >
              → Documentación: Google OAuth con Supabase
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
