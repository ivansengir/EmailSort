import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../DashboardPage';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'owner@example.com' },
  }),
}));

const mockFetchCategories = vi.fn();
const mockAddCategory = vi.fn();
const mockFetchGmailAccounts = vi.fn();
const mockInvokeEmailSync = vi.fn();

const authMock = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
}));

vi.mock('../../lib/auth', async () => {
  const actual = await vi.importActual<typeof import('../../lib/auth')>('../../lib/auth');
  return {
    ...actual,
    signInWithGoogle: authMock.signInWithGoogle,
  };
});

vi.mock('../../lib/data', () => ({
  fetchCategories: () => mockFetchCategories(),
  addCategory: (args: unknown) => mockAddCategory(args),
  fetchGmailAccounts: () => mockFetchGmailAccounts(),
  invokeEmailSync: (id?: string) => mockInvokeEmailSync(id),
}));

describe('DashboardPage', () => {
  function renderWithinRouter() {
    return render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
  }

  beforeEach(() => {
    mockFetchCategories.mockResolvedValue([{ id: 'cat-1', user_id: 'user-1', name: 'Newsletters', description: 'Marketing emails', color: '#3b82f6', email_count: 3, order_index: 0, created_at: '', updated_at: '' }]);
    mockFetchGmailAccounts.mockResolvedValue([
      {
        id: 'acc-1',
        user_id: 'user-1',
        email: 'owner@example.com',
        oauth_token: 'token',
        oauth_refresh_token: 'refresh',
        token_expires_at: new Date().toISOString(),
        is_primary: true,
        last_sync_at: null,
        created_at: '',
        updated_at: '',
      },
    ]);
    mockAddCategory.mockResolvedValue(undefined);
    mockInvokeEmailSync.mockResolvedValue({ syncedEmails: [] });
    authMock.signInWithGoogle.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders linked inboxes and categories', async () => {
    renderWithinRouter();

    await screen.findByText('Gmail Accounts');
    expect(screen.getAllByText('owner@example.com')).toHaveLength(2);
    expect(screen.getByText('Newsletters')).toBeInTheDocument();
  });

  it('triggers category creation workflow', async () => {
    renderWithinRouter();

    await screen.findByText('New Category');
    fireEvent.click(screen.getByText('New Category'));    const nameInput = await screen.findByPlaceholderText('Category name (e.g., Newsletters)');
    fireEvent.change(nameInput, { target: { value: 'Finance' } });
    fireEvent.change(screen.getByPlaceholderText('Description for AI categorization...'), { target: { value: 'Bank statements' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(mockAddCategory).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'Finance',
        description: 'Bank statements',
      });
    });
  });

  it('starts Gmail sync for all inboxes', async () => {
    renderWithinRouter();

    await screen.findByText('Sync all now');
    fireEvent.click(screen.getByText('Sync all now'));

    await waitFor(() => {
      expect(mockInvokeEmailSync).toHaveBeenCalledWith(undefined);
    });
  });
});
