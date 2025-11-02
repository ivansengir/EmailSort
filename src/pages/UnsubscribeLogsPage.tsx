import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUnsubscribeLogs, UnsubscribeLog } from '../lib/data';
import { ArrowLeft, CheckCircle, XCircle, Clock, Mail, ExternalLink } from 'lucide-react';

export function UnsubscribeLogsPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<UnsubscribeLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setIsLoading(true);
    const data = await fetchUnsubscribeLogs(50);
    setLogs(data);
    setIsLoading(false);
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <Mail className="w-5 h-5 text-gray-600" />;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getMethodBadge(method: string | null) {
    if (!method) return null;
    
    const colors: Record<string, string> = {
      http: 'bg-blue-100 text-blue-800',
      'form-auto': 'bg-green-100 text-green-800',
      'ai-auto': 'bg-purple-100 text-purple-800',
      header: 'bg-cyan-100 text-cyan-800',
      mailto: 'bg-orange-100 text-orange-800',
      manual: 'bg-orange-100 text-orange-800',
      unknown: 'bg-gray-100 text-gray-800',
    };

    const labels: Record<string, string> = {
      http: '🔗 Direct Link',
      'form-auto': '📝 Auto Form',
      'ai-auto': '🤖 AI Assisted',
      header: '📧 Email Header',
      mailto: '✉️ Email Required',
      manual: '👤 Manual',
      unknown: '❓ Unknown',
    };

    return (
      <span className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${colors[method] || 'bg-gray-100 text-gray-800'}`}>
        {labels[method] || method}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Unsubscribe Logs</h1>
          <p className="text-sm text-gray-600 mt-1">
            History of unsubscribe attempts and their status
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No unsubscribe attempts yet</p>
            <p className="text-sm text-gray-500 mt-2">
              Unsubscribe logs will appear here when you attempt to unsubscribe from emails
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Link / Error
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900 truncate max-w-md">
                          {log.email?.subject || 'Unknown'}
                        </div>
                        <div className="text-gray-500 truncate max-w-md">
                          {log.email?.from_email || 'Unknown sender'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getMethodBadge(log.unsubscribe_method)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {log.unsubscribe_target ? (
                        <a
                          href={log.unsubscribe_target}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1 max-w-md truncate"
                        >
                          <ExternalLink className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{log.unsubscribe_target}</span>
                        </a>
                      ) : log.error_message ? (
                        <span className="text-red-600">{log.error_message}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-2xl p-6 shadow-lg">
          <h3 className="font-bold text-purple-900 mb-3 text-lg flex items-center gap-2">
            <span className="text-2xl">🤖</span> AI-Powered Unsubscribe Engine
          </h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-purple-800 mb-2">Status Guide:</h4>
              <ul className="space-y-1.5 text-sm text-purple-900">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✅</span>
                  <span><strong>success</strong> - AI successfully unsubscribed (no action needed!)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">❌</span>
                  <span><strong>error</strong> - AI couldn't automate (CAPTCHA, login, or no link found)</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-purple-800 mb-2">AI Methods:</h4>
              <ul className="space-y-1.5 text-sm text-purple-900">
                <li><strong>🔗 Direct Link</strong> - AI clicked the unsubscribe link</li>
                <li><strong>📝 Auto Form</strong> - AI detected and submitted a form automatically</li>
                <li><strong>🤖 AI Assisted</strong> - AI analyzed the page and guided the process</li>
                <li><strong>✉️ Email Required</strong> - Requires sending an email (can't automate)</li>
                <li><strong>👤 Manual</strong> - Requires human interaction (CAPTCHA, login, etc.)</li>
              </ul>
            </div>

            <div className="bg-white/60 rounded-xl p-4 border border-purple-200">
              <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                <span>⚡</span> How It Works:
              </h4>
              <ol className="space-y-2 text-sm text-purple-900 list-decimal list-inside">
                <li><strong>AI analyzes</strong> the email to find unsubscribe links (any language)</li>
                <li><strong>AI visits</strong> the link and analyzes the destination page</li>
                <li><strong>AI decides</strong> if it's a success page, form, CAPTCHA, or login</li>
                <li><strong>AI acts</strong> automatically if possible (submits forms, confirms, etc.)</li>
              </ol>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
