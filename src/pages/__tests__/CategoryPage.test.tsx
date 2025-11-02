import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CategoryPage } from '../CategoryPage';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'owner@example.com' },
  }),
}));

const mockFetchCategories = vi.fn();
const mockFetchEmailsByCategory = vi.fn();
const mockExecuteBulk = vi.fn();
const mockInvokeSync = vi.fn();
const mockUpdateSelection = vi.fn();
const mockClearSelections = vi.fn();

vi.mock('../../lib/data', () => ({
  fetchCategories: () => mockFetchCategories(),
  fetchEmailsByCategory: (categoryId: string) => mockFetchEmailsByCategory(categoryId),
  executeBulkAction: (action: 'delete' | 'unsubscribe', payload: { emailIds: string[] }) =>
    mockExecuteBulk(action, payload),
  invokeEmailSync: () => mockInvokeSync(),
  updateEmailSelection: (ids: string[], selected: boolean) => mockUpdateSelection(ids, selected),
  clearSelectionsForCategory: (categoryId: string) => mockClearSelections(categoryId),
}));

describe('CategoryPage', () => {
  beforeEach(() => {
    mockFetchCategories.mockResolvedValue([
      { id: 'cat-1', user_id: 'user-1', name: 'Newsletters', description: 'Marketing emails', color: '#3b82f6', email_count: 2, created_at: '', updated_at: '' },
    ]);
    mockFetchEmailsByCategory.mockResolvedValue([
      {
        id: 'email-1',
        user_id: 'user-1',
        gmail_account_id: 'acc-1',
        category_id: 'cat-1',
        gmail_message_id: 'gm-1',
        gmail_thread_id: 'gt-1',
        subject: 'Welcome to the newsletter',
        from_email: 'news@example.com',
        from_name: 'News',
        to_email: 'owner@example.com',
        date: new Date().toISOString(),
        content_text: 'Plain text body',
        content_html: '<p>Plain text body</p>',
        ai_summary: 'Summary text',
        categorization_confidence: 0.95,
        is_archived: true,
        is_deleted: false,
        created_at: '',
        updated_at: '',
      },
    ]);
    mockExecuteBulk.mockResolvedValue({ results: [] });
    mockInvokeSync.mockResolvedValue({});
    mockUpdateSelection.mockResolvedValue(undefined);
    mockClearSelections.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderWithinRouter() {
    return render(
      <MemoryRouter initialEntries={[`/categories/cat-1`]}> 
        <Routes>
          <Route path="/categories/:categoryId" element={<CategoryPage />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('loads category and emails', async () => {
    renderWithinRouter();

    await screen.findByText('Newsletters');
    await screen.findByText('Summary text');
  });

  it('allows selecting emails and running bulk delete', async () => {
    renderWithinRouter();

    const checkbox = await screen.findByRole('checkbox');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockUpdateSelection).toHaveBeenCalledWith(['email-1'], true);
    });

    fireEvent.click(screen.getByText('Delete selected'));

    await waitFor(() => {
      expect(mockExecuteBulk).toHaveBeenCalledWith('delete', { emailIds: ['email-1'] });
    });
  });
});
