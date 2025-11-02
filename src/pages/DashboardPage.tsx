import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { fetchCategories, addCategory, fetchGmailAccounts, invokeEmailSync, deleteGmailAccount } from '../lib/data';
import type { Category, GmailAccount } from '../types';
import { LogOut, Plus, Folder, RefreshCcw, Link, Trash2, FileText, Mail, Sparkles, TrendingUp } from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ categoryId: string; categoryName: string } | null>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState<{ accountId: string; email: string } | null>(null);
  const [categoryPage, setCategoryPage] = useState(1);
  const categoriesPerPage = 10;
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [accountsResult, categoriesResult] = await Promise.all([
        fetchGmailAccounts(),
        fetchCategories(),
      ]);
      setAccounts(accountsResult);
      setCategories(categoriesResult);
      
      // Show helpful message if no categories exist
      if (categoriesResult.length === 0 && !feedback) {
        setFeedback('💡 Tip: Create categories to organize your emails before syncing');
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, feedback]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function createCategory() {
    if (!user || !newCategory.name || !newCategory.description) return;
    try {
      await addCategory({
        userId: user.id,
        name: newCategory.name,
        description: newCategory.description,
      });
      setFeedback('Category created successfully');
      setNewCategory({ name: '', description: '' });
      setShowModal(false);
      await loadData();
    } catch (error) {
      console.error('Failed to create category', error);
      setFeedback('Error creating category');
    }
  }

  async function handleSync(accountId?: string, syncMode?: 'last30' | 'all') {
    try {
      if (categories.length === 0) {
        setFeedback('⚠️ Please create at least one category before syncing emails');
        return;
      }
      
      // Show confirmation for 'all' mode
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
      setFeedback(null); // Clear previous feedback
      
      const result = await invokeEmailSync(accountId, true, syncMode);
      
      if (result?.needsCategories) {
        setFeedback('⚠️ Please create at least one category before syncing emails');
      } else if (result?.rateLimitHit) {
        setFeedback('⚠️ OpenAI rate limit reached! Some emails were not processed. Wait 1 minute and try syncing again.');
      } else if (result?.syncedEmails?.length === 0) {
        setFeedback('✓ Sync completed - No new emails found');
      } else {
        const imported = result?.syncedEmails?.filter((e: { error?: string }) => !e.error).length || 0;
        setFeedback(`✓ Sync completed - ${imported} emails imported`);
      }
      await loadData();
    } catch (error) {
      console.error('Sync failed', error);
      const errorMessage = error instanceof Error ? error.message : 'Email sync failed. Check console for details.';
      setFeedback(`❌ ${errorMessage}`);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  }

  async function handleConnectAnotherAccount() {
    const message = `Currently, you can only manage one Gmail account per Google login.

To add a different Gmail account:
1. Sign out (top right)
2. Sign in with the other Google account

Note: Each Google account has its own separate EmailSort workspace.

Do you want to sign out now and switch accounts?`;

    if (confirm(message)) {
      try {
        await signOut();
      } catch (error) {
        console.error('Failed to sign out:', error);
        setFeedback('Failed to sign out. Please try again.');
      }
    }
  }

  async function handleDeleteAccount(accountId: string, email: string) {
    setConfirmDeleteAccount({ accountId, email });
  }

  async function executeDeleteAccount() {
    if (!confirmDeleteAccount) return;
    
    const { accountId, email } = confirmDeleteAccount;

    try {
      setFeedback(`Removing account "${email}"...`);
      setConfirmDeleteAccount(null); // Close modal
      
      await deleteGmailAccount(accountId);
      setFeedback(`✓ Account "${email}" removed successfully`);
      await loadData();
    } catch (error) {
      console.error('Failed to delete account:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setFeedback(`❌ Failed to remove account "${email}": ${errorMessage}`);
    }
  }

  async function handleDeleteCategory(categoryId: string, categoryName: string) {
    // Show confirmation modal instead of browser alert
    setConfirmDelete({ categoryId, categoryName });
  }

  async function confirmDeleteCategory() {
    if (!confirmDelete) return;
    
    const { categoryId, categoryName } = confirmDelete;

    try {
      setFeedback(`Deleting category "${categoryName}"...`);
      setConfirmDelete(null); // Close modal
      
      // First, verify we have a valid session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session. Please log in again.');
      }

      // Get the current user's ID from the users table
      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single();

      if (userError || !currentUser) {
        throw new Error('User profile not found');
      }

      // Delete the category (emails will be cascade deleted)
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)
        .eq('user_id', currentUser.id); // Ensure user owns this category

      if (error) throw error;
      
      setFeedback(`✓ Category "${categoryName}" deleted successfully`);
      await loadData();
    } catch (error) {
      console.error('Failed to delete category:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setFeedback(`❌ Failed to delete category "${categoryName}": ${errorMessage}`);
    }
  }

  function handleCategoryClick(categoryId: string) {
    navigate(`/categories/${categoryId}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  EmailSort AI
                </h1>
                <p className="text-xs text-gray-500">Intelligent Email Management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/unsubscribe-logs')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="View unsubscribe logs"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Unsubscribe Logs</span>
              </button>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-gray-700 hidden sm:inline max-w-[150px] truncate">{user?.email}</span>
              </div>
              <button
                onClick={signOut}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {feedback && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 text-indigo-900 px-4 py-3 rounded-xl flex items-center gap-2 shadow-sm" role="status">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Categories</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{categories.length}</p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-xl">
                <Folder className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Gmail Accounts</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{accounts.length}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <Mail className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Emails</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {categories.reduce((sum, cat) => sum + (cat.email_count || 0), 0)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Gmail Accounts</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage your connected inboxes
              </p>
            </div>
            <button
              onClick={handleConnectAnotherAccount}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm hover:shadow-md transition-all"
            >
              <Link className="w-4 h-4" />
              Connect Account
            </button>
          </div>

          {isLoading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium mb-2">No Gmail accounts connected</p>
              <p className="text-sm text-gray-500">Connect your Gmail to start organizing emails</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map((account) => (
                <div key={account.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-semibold">
                        {account.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{account.email}</p>
                        <p className="text-xs text-gray-500">
                          {account.is_primary ? '⭐ Primary' : 'Secondary'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteAccount(account.id, account.email)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Remove account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>Last sync: {account.last_sync_at ? new Date(account.last_sync_at).toLocaleString() : 'Never'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleSync(account.id)}
                      disabled={isSyncing}
                      className="text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white py-2 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1"
                      title="Sync new emails only"
                    >
                      <RefreshCcw className="w-3 h-3" />
                      Sync New
                    </button>
                    <button
                      onClick={() => handleSync(account.id, 'last30')}
                      disabled={isSyncing}
                      className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-2 rounded-lg font-medium transition-all"
                      title="Sync last 30 emails"
                    >
                      Last 30
                    </button>
                    <button
                      onClick={() => handleSync(account.id, 'all')}
                      disabled={isSyncing}
                      className="text-xs bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white py-2 px-2 rounded-lg font-medium transition-all"
                      title="Sync all emails (up to 500)"
                    >
                      All
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

                {/* Categories Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Custom Categories
              </h2>
              <p className="text-sm text-gray-600 mt-1">Tell the AI how to organize your inbox.</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-purple-500/30 transition-all hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              New Category
            </button>
          </div>

          {categories.length === 0 ? (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-12 text-center border-2 border-dashed border-gray-300">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <p className="text-gray-600 text-lg font-medium">No categories yet</p>
              <p className="text-gray-500 text-sm mt-2">Create your first category to organize your emails with AI</p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {categories
                  .slice((categoryPage - 1) * categoriesPerPage, categoryPage * categoriesPerPage)
                  .map((category) => (
                  <div
                    key={category.id}
                    onClick={() => handleCategoryClick(category.id)}
                    className="group bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 shadow-lg hover:shadow-xl border border-gray-200 hover:border-purple-300 cursor-pointer transition-all hover:scale-105"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-purple-600 transition-colors mb-2">
                          {category.name}
                        </h3>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                          {category.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 rounded-lg text-xs font-semibold">
                            <Mail className="w-3.5 h-3.5" />
                            {category.email_count || 0} emails
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(category.id, category.name);
                        }}
                        className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete category"
                      >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 pt-3 border-t border-gray-200">
                    <span className="group-hover:text-purple-600 transition-colors">Click to view emails →</span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination Controls */}
            {categories.length > categoriesPerPage && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCategoryPage(p => Math.max(1, p - 1))}
                  disabled={categoryPage === 1}
                  className="px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  Page {categoryPage} of {Math.ceil(categories.length / categoriesPerPage)}
                </span>
                <button
                  onClick={() => setCategoryPage(p => Math.min(Math.ceil(categories.length / categoriesPerPage), p + 1))}
                  disabled={categoryPage === Math.ceil(categories.length / categoriesPerPage)}
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

      {/* Create Category Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Create Category
              </h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Newsletters, Promotions, Work"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI Description
                </label>
                <textarea
                  placeholder="Describe what emails should go here. Be specific for better AI categorization..."
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl h-32 resize-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all outline-none"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-6 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createCategory}
                disabled={!newCategory.name || !newCategory.description}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-300 text-white rounded-xl font-medium shadow-lg shadow-purple-500/30 transition-all disabled:shadow-none"
              >
                Create Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete Category */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Category</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete the category <strong>"{confirmDelete.categoryName}"</strong>? 
              This will also remove all emails in this category from the app.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteCategory}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-red-500/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete Gmail Account */}
      {confirmDeleteAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Remove Gmail Account</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              Are you sure you want to remove the account <strong>"{confirmDeleteAccount.email}"</strong>? 
              This will also delete all emails from this account.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteAccount(null)}
                className="flex-1 px-4 py-2.5 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteAccount}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-red-500/30"
              >
                Remove Account
              </button>
            </div>
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
