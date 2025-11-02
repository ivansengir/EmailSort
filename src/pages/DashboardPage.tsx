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
  const [feedback, setFeedback] = useState<string | null>(null);
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

  async function handleSync(accountId?: string) {
    try {
      if (categories.length === 0) {
        setFeedback('⚠️ Please create at least one category before syncing emails');
        return;
      }
      setIsSyncing(true);
      setFeedback('Syncing emails...');
      const result = await invokeEmailSync(accountId);
      
      if (result?.needsCategories) {
        setFeedback('⚠️ Please create at least one category before syncing emails');
      } else if (result?.syncedEmails?.length === 0) {
        setFeedback('✓ Sync completed - No new emails found');
      } else {
        setFeedback(`✓ Sync completed - ${result?.syncedEmails?.length || 0} emails imported`);
      }
      await loadData();
    } catch (error) {
      console.error('Sync failed', error);
      const errorMessage = error instanceof Error ? error.message : 'Email sync failed. Check console for details.';
      setFeedback(`❌ ${errorMessage}`);
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleTestGmail() {
    try {
      setFeedback('🔍 Testing Gmail API connection...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      
      const { data, error } = await supabase.functions.invoke('test-gmail', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      if (error) throw error;
      
      console.log('Gmail API Test Results:', data);
      
      if (data.success) {
        const totalMessages = Object.values(data.queries as Record<string, { messageCount?: number }>).reduce(
          (sum: number, q) => sum + (q.messageCount || 0), 
          0
        );
        setFeedback(`✓ Gmail API working! Found ${totalMessages} total messages. Check console for details.`);
      } else {
        setFeedback('❌ Gmail API test failed. Check console for details.');
      }
    } catch (error) {
      console.error('Gmail test failed:', error);
      setFeedback(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function handleTestBulkActions() {
    if (!confirm('⚠️ This will archive and delete one email from your inbox for testing. Continue?')) {
      return;
    }
    
    try {
      setFeedback('🧪 Testing bulk actions (delete/archive)...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      
      const { data, error } = await supabase.functions.invoke('test-bulk', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      if (error) throw error;
      
      console.log('Bulk Actions Test Results:', data);
      
      if (data.status === 'success') {
        setFeedback(`✓ Bulk actions test passed! Email "${data.email.subject}" was archived and deleted. Check console for details.`);
      } else {
        setFeedback(`❌ Bulk actions test failed at: ${data.test}. Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Bulk actions test failed:', error);
      setFeedback(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    if (!confirm(`Are you sure you want to remove the account "${email}"? This will also delete all emails from this account.`)) {
      return;
    }

    try {
      await deleteGmailAccount(accountId);
      setFeedback(`✓ Account "${email}" removed successfully`);
      await loadData();
    } catch (error) {
      console.error('Failed to delete account:', error);
      setFeedback(`❌ Failed to remove account "${email}"`);
    }
  }

  async function handleDeleteCategory(categoryId: string, categoryName: string) {
    if (!confirm(`Are you sure you want to delete the category "${categoryName}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;
      
      setFeedback(`✓ Category "${categoryName}" deleted successfully`);
      await loadData();
    } catch (error) {
      console.error('Failed to delete category:', error);
      setFeedback(`❌ Failed to delete category "${categoryName}"`);
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
                <span className="hidden sm:inline">Logs</span>
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
                  <div className="flex gap-2">
                    <button
                      onClick={handleTestGmail}
                      className="flex-1 text-xs text-purple-600 hover:bg-purple-50 py-2 px-3 rounded-lg border border-purple-200 transition-colors"
                    >
                      🔍 Test API
                    </button>
                    <button
                      onClick={handleTestBulkActions}
                      className="flex-1 text-xs text-orange-600 hover:bg-orange-50 py-2 px-3 rounded-lg border border-orange-200 transition-colors"
                    >
                      🧪 Test Bulk
                    </button>
                    <button
                      onClick={() => handleSync(account.id)}
                      disabled={isSyncing}
                      className="flex-1 text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1"
                    >
                      <RefreshCcw className="w-3 h-3" />
                      Sync
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
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
    </div>
  );
}
