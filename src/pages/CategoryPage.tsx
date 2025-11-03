import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchEmailsByCategory,
  fetchCategories,
  executeBulkAction,
  invokeEmailSync,
  updateEmailSelection,
  clearSelectionsForCategory,
  moveEmailsToCategory,
} from '../lib/data';
import type { Category, Email } from '../types';
import { ArrowLeft, Trash2, MailOpen, ShieldCheck, RefreshCcw, Mail, CheckSquare, Square, FileText, Sparkles, FolderInput } from 'lucide-react';
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [emailPage, setEmailPage] = useState(1);
  const emailsPerPage = 10;
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

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
    setEmailPage(1); // Reset to first page when loading new data
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

  async function handleResync(syncMode?: 'last30' | 'all') {
    try {
      if (syncMode === 'all') {
        const confirmed = confirm(
          '⚠️ Sync All will process up to 500 emails. This may take several minutes and could hit OpenAI rate limits.\n\n' +
          'If rate limits are reached, wait 1 minute and click Sync All again to continue.\n\n' +
          'Continue?'
        );
        if (!confirmed) return;
      }
      
      setIsSyncing(true);
      const modeText = syncMode === 'all' ? 'all emails (up to 500)' : syncMode === 'last30' ? 'last 30 emails' : 'new emails';
      setSyncProgress(`Syncing ${modeText}... Please wait, do not close this page.`);
      setToast(null); // Clear previous toast
      
      const result = await invokeEmailSync(undefined, true, syncMode);
      
      if (result?.rateLimitHit) {
        setToast('⚠️ OpenAI rate limit reached! Wait 1 minute and try syncing again.');
      } else {
        const imported = result?.syncedEmails?.filter((e: { error?: string }) => !e.error).length || 0;
        setToast(`✓ Sync completed - ${imported} emails imported`);
      }
      
      await loadCategoryData();
    } catch (error) {
      console.error('Sync failed', error);
      setToast('Sync failed. Review console logs.');
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  }

  async function handleMoveEmails(targetCategoryId: string) {
    if (!selectedEmails.length) {
      setToast('Select at least one email first.');
      return;
    }

    try {
      setIsMoving(true);
      setToast(`Moving ${selectedEmails.length} emails...`);
      
      const result = await moveEmailsToCategory(selectedEmails, targetCategoryId);
      
      if (result?.success) {
        setToast(`✓ Moved ${result.movedCount} emails to ${result.targetCategory}`);
        setShowMoveModal(false);
        await loadCategoryData();
      } else {
        const errorMsg = result?.error || 'Unknown error';
        const details = result?.details ? ` (${result.details})` : '';
        setToast(`Failed to move emails: ${errorMsg}${details}`);
      }
    } catch (error) {
      console.error('Move emails failed', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setToast(`Failed to move emails: ${errorMessage}`);
    } finally {
      setIsMoving(false);
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
                onClick={() => navigate('/unsubscribe-logs')}
                className="flex items-center gap-2 px-4 py-2 text-sm border-2 border-gray-200 rounded-xl text-gray-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                title="View unsubscribe logs"
              >
                <FileText className="w-4 h-4" />
                Unsubscribe Logs
              </button>
              
              {/* Sync options */}
              <div className="flex items-center gap-1 border-2 border-gray-200 rounded-xl p-1">
                <button
                  onClick={() => handleResync()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                  title="Sync new emails only"
                >
                  <RefreshCcw className="w-3 h-3" />
                  New
                </button>
                <button
                  onClick={() => handleResync('last30')}
                  className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all"
                  title="Sync last 30 emails"
                >
                  Last 30
                </button>
                <button
                  onClick={() => handleResync('all')}
                  className="px-3 py-1.5 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-lg transition-all"
                  title="Sync all emails (up to 500)"
                >
                  All
                </button>
              </div>
              
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
              <button
                onClick={() => setShowMoveModal(true)}
                disabled={!selectedEmails.length || isMoving}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30 transition-all"
              >
                <FolderInput className="w-4 h-4" />
                Move ({selectedEmails.length})
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
            <>
              {emails
                .slice((emailPage - 1) * emailsPerPage, emailPage * emailsPerPage)
                .map((email) => {
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
                      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">AI Summary</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {email.ai_summary}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            
            {/* Pagination Controls for Emails */}
            {emails.length > emailsPerPage && (
              <div className="flex items-center justify-center gap-2 mt-8 pt-8 border-t border-gray-200">
                <button
                  onClick={() => setEmailPage(p => Math.max(1, p - 1))}
                  disabled={emailPage === 1}
                  className="px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  Page {emailPage} of {Math.ceil(emails.length / emailsPerPage)} ({emails.length} emails)
                </span>
                <button
                  onClick={() => setEmailPage(p => Math.min(Math.ceil(emails.length / emailsPerPage), p + 1))}
                  disabled={emailPage === Math.ceil(emails.length / emailsPerPage)}
                  className="px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            )}
            </>
          )}
        </section>
      </main>

      <EmailDetailModal email={activeEmail} onClose={() => setActiveEmail(null)} />
      
      {/* Move Emails Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Move {selectedEmails.length} email{selectedEmails.length > 1 ? 's' : ''} to:
            </h3>
            
            <div className="space-y-2 max-h-96 overflow-y-auto mb-6">
              {categories
                .filter(cat => cat.id !== categoryId) // Don't show current category
                .map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleMoveEmails(cat.id)}
                    disabled={isMoving}
                    className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 group-hover:text-indigo-600 mb-1">
                          {cat.name}
                        </h4>
                        <p className="text-sm text-gray-600 line-clamp-1">
                          {cat.description}
                        </p>
                      </div>
                      <div 
                        className="w-4 h-4 rounded-full ml-3"
                        style={{ backgroundColor: cat.color || '#3b82f6' }}
                      />
                    </div>
                  </button>
                ))}
            </div>
            
            <button
              onClick={() => setShowMoveModal(false)}
              disabled={isMoving}
              className="w-full py-3 px-4 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Sync Progress Overlay - Blocks interaction during sync */}
      {isSyncing && syncProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 mx-4">
            <div className="flex flex-col items-center gap-6">
              {/* Animated spinner */}
              <div className="relative">
                <div className="w-20 h-20 border-4 border-indigo-200 rounded-full"></div>
                <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              </div>
              
              {/* Progress message */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Syncing Emails...
                </h3>
                <p className="text-gray-600 mb-4">
                  {syncProgress}
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                  <span>Processing with AI...</span>
                </div>
              </div>
              
              {/* Info message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 w-full">
                <p className="text-sm text-blue-800 text-center">
                  ⏱️ This may take a few moments depending on the number of emails
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
