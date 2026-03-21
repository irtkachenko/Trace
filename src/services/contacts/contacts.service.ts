import { supabase } from '@/lib/supabase/client';
import { handleError } from '@/shared/lib/error-handler';
import { NetworkError } from '@/shared/lib/errors';
import type { User } from '@/types';

export const contactsApi = {
  /**
   * Search users (contacts)
   */
  searchUsers: async (currentUserId: string, queryText: string) => {
    if (queryText.trim().length < 2) {
      return [];
    }

    const { data, error } = await supabase.rpc('search_users', {
      p_query: queryText.trim()
    });

    if (error) {
      const networkError = new NetworkError(
        error.message,
        'contacts',
        'CONTACTS_SEARCH_ERROR',
        error.status || 500,
      );
      handleError(networkError, 'ContactsApi.searchUsers');
      throw networkError;
    }

    return data as User[];
  },
};
