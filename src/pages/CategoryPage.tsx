import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchEmailsByCategory,
  fetchCategories,
  executeBulkAction,
  invokeEmailSync,
  updateEmailSelection,
  clearSelectionsForCategory,
} from '../lib/data';
import type { Category, Email } from '../types';
import { ArrowLeft, Trash2, MailOpen, ShieldCheck, RefreshCcw, Mail, CheckSquare, Square } from 'lucide-react';
import { EmailDetailModal } from '../components/EmailDetailModal';

export function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [activeEmail, setActiveEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningAction, setIsRunningAction] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const category = useMemo(
    () => categories.find((cat: Category) => cat.id === categoryId) ?? null,
    [categories, categoryId]
  );

  const loadCategoryData = useCallback(async () => {
    if (!categoryId) return;
    setIsLoading(true);
    const [categoryList, emailList] = await Promise.all([
      fetchCategories(),
      fetchEmailsByCategory(categoryId),
    ]);
    setCategories(categoryList);
    setEmails(emailList);
    setSelectedEmails([]);
    setIsLoading(false);
  }, [categoryId]);

  useEffect(() => {
    if (!categoryId) return;
    loadCategoryData();
  }, [categoryId, loadCategoryData]);

  async function toggleEmailSelection(emailId: string) {
    const isCurrentlySelected = selectedEmails.includes(emailId);
    const newSelectionState = !isCurrentlySelected;
    
    setSelectedEmails((prev: string[]) =>
      isCurrentlySelected ? prev.filter((id: string) => id !== emailId) : [...prev, emailId]
    );
    
    try {
      await updateEmailSelection([emailId], newSelectionState);
    } catch (error) {
      console.error('Failed to update selection', error);
      setToast('Could not persist email selection state.');
    }
  }

  async function toggleSelectAll() {
    if (selectedEmails.length === emails.length) {
      setSelectedEmails([]);
      if (categoryId) {
        await clearSelectionsForCategory(categoryId);
      }
    } else {
      const ids = emails.map((email: Email) => email.id);
      setSelectedEmails(ids);
      try {
        await updateEmailSelection(ids, true);
      } catch (error) {
        console.error('Failed to persist select-all', error);
      }
    }
  }

  async function runBulkAction(action: 'delete' | 'unsubscribe') {
    if (!selectedEmails.length) {
      setToast('Select at least one email first.');
      return;
    }

    try {
      setIsRunningAction(true);
      setToast(`Running ${action} on ${selectedEmails.length} emails...`);
      const result = await executeBulkAction(action, { emailIds: selectedEmails });
      
      console.log('Bulk action result:', result);
      
      // Show detailed results
      if (result?.results) {
        const successful = result.results.filter((r: { status: string }) => 
          r.status === 'deleted' || r.status === 'success' || r.status === 'pending'
        ).length;
        const failed = result.results.filter((r: { status: string }) => r.status === 'error').length;
        
        if (action === 'delete') {
          setToast(`✓ Deleted ${successful} emails${failed > 0 ? `, ${failed} failed` : ''}`);
        } else {
          setToast(`✓ Unsubscribe: ${successful} processed${failed > 0 ? `, ${failed} failed` : ''}. Check Logs for details.`);
        }
      } else {
        setToast('Bulk action completed.');
      }
      
      await loadCategoryData();
    } catch (error) {
      console.error('Bulk action failed', error);
      setToast('Bulk action failed. Check console for details.');
    } finally {
      setIsRunningAction(false);
    }
  }

  async function handleResync() {
    try {
      setToast('Triggering Gmail sync for this category...');
      await invokeEmailSync();
      await loadCategoryData();
    } catch (error) {
      console.error('Sync failed', error);
      setToast('Sync failed. Review console logs.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">Back to Dashboard</span>
            </button>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleResync}
                className="flex items-center gap-2 px-4 py-2 text-sm border-2 border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 hover:border-purple-300 transition-all"
              >
                <RefreshCcw className="w-4 h-4" />
                Sync
              </button>
              <button
                onClick={() => runBulkAction('delete')}
                disabled={!selectedEmails.length || isRunningAction}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/30 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedEmails.length})
              </button>
              <button
                onClick={() => runBulkAction('unsubscribe')}
                disabled={!selectedEmails.length || isRunningAction}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30 transition-all"
              >
                <ShieldCheck className="w-4 h-4" />
                Unsubscribe ({selectedEmails.length})
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Toast Notification */}
        {toast && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 text-blue-800 px-6 py-4 rounded-2xl shadow-lg" role="status">
            <p className="font-medium">{toast}</p>
          </div>
        )}

        {/* Category Header */}
        {category && (
          <section className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-2xl shadow-xl p-8">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
                  {category.name}
                </h1>
                <p className="text-gray-600 text-lg mb-4">{category.description}</p>
                <div className="flex items-center gap-6 text-sm">
                  <span className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 rounded-lg font-medium">
                    <Mail className="w-4 h-4" />
                    {emails.length} emails
                  </span>
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-200 hover:border-purple-300 rounded-lg font-medium text-gray-700 hover:text-purple-600 transition-all"
                    onClick={toggleSelectAll}
                  >
                    {selectedEmails.length === emails.length ? (
                      <>
                        <CheckSquare className="w-4 h-4" />
                        Clear selection
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4" />
                        Select all
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Email List */}
        <section className="space-y-4">
          {isLoading ? (
            <div className="bg-white rounded-2xl p-12 text-center">
              <div className="animate-spin w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500 font-medium">Loading emails...</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="bg-gradient-to-br from-white to-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-16 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <MailOpen className="w-10 h-10 text-white" />
              </div>
              <p className="text-gray-600 text-lg font-medium">No emails in this category yet</p>
              <p className="text-gray-500 text-sm mt-2">Sync your inbox to see emails here</p>
            </div>
          ) : (
            emails.map((email) => {
              const isSelected = selectedEmails.includes(email.id);
              return (
                <article
                  key={email.id}
                  className={`bg-gradient-to-br from-white to-gray-50 border-2 rounded-2xl shadow-sm p-6 transition-all hover:shadow-lg ${
                    isSelected
                      ? 'border-purple-500 ring-4 ring-purple-100 shadow-purple-200'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleEmailSelection(email.id)}
                      aria-label={`Select email ${email.subject}`}
                      className="mt-1 h-5 w-5 rounded border-2 border-gray-300 text-purple-600 focus:ring-2 focus:ring-purple-500 cursor-pointer"
                    />
                    <div className="flex-1 cursor-pointer" onClick={() => setActiveEmail(email)}>
                      <div className="flex justify-between items-start gap-4 mb-3">
                        <div className="flex-1">
                          <p className="text-sm text-gray-500 mb-1">{email.from_email}</p>
                          <h2 className="text-lg font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                            {email.subject}
                          </h2>
                        </div>
                        <p className="text-xs text-gray-400 font-medium bg-gray-100 px-3 py-1 rounded-lg">
                          {new Date(email.date).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed bg-gradient-to-br from-gray-50 to-white p-4 rounded-xl border border-gray-100">
                        {email.ai_summary}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </main>

      <EmailDetailModal email={activeEmail} onClose={() => setActiveEmail(null)} />
    </div>
  );
}
