import { useUserStore } from '../../stores/userStore';
import { usersApi } from '@sync/api-client';

// Mock the API client
jest.mock('@sync/api-client', () => ({
  usersApi: {
    getTokenBalance: jest.fn(),
    getVotingHistory: jest.fn(),
  },
}));

describe('User Store', () => {
  const mockTokenBalance = {
    balance: 500,
    pending: 50,
    currency: 'TARO',
  };

  const mockVotingHistory = [
    {
      voteId: 'vote-1',
      optionId: 'option-a',
      createdAt: new Date('2025-01-15'),
    },
    {
      voteId: 'vote-2',
      optionId: 'option-b',
      createdAt: new Date('2025-01-10'),
    },
  ];

  beforeEach(() => {
    // Reset the store state before each test
    useUserStore.setState({
      tokenBalance: null,
      votingHistory: [],
      isLoading: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useUserStore.getState();

      expect(state.tokenBalance).toBeNull();
      expect(state.votingHistory).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchTokenBalance', () => {
    it('should set loading state while fetching', async () => {
      (usersApi.getTokenBalance as jest.Mock).mockImplementation(() => {
        // Check loading state during fetch
        expect(useUserStore.getState().isLoading).toBe(true);
        return Promise.resolve(mockTokenBalance);
      });

      await useUserStore.getState().fetchTokenBalance();
    });

    it('should populate token balance on successful fetch', async () => {
      (usersApi.getTokenBalance as jest.Mock).mockResolvedValue(mockTokenBalance);

      await useUserStore.getState().fetchTokenBalance();

      expect(useUserStore.getState().tokenBalance).toEqual(mockTokenBalance);
      expect(useUserStore.getState().isLoading).toBe(false);
    });

    it('should set error on fetch failure with Error', async () => {
      (usersApi.getTokenBalance as jest.Mock).mockRejectedValue(new Error('API Error'));

      await useUserStore.getState().fetchTokenBalance();

      expect(useUserStore.getState().tokenBalance).toBeNull();
      expect(useUserStore.getState().isLoading).toBe(false);
      expect(useUserStore.getState().error).toBe('API Error');
    });

    it('should set Hebrew error message for non-Error exceptions', async () => {
      (usersApi.getTokenBalance as jest.Mock).mockRejectedValue('Unknown');

      await useUserStore.getState().fetchTokenBalance();

      expect(useUserStore.getState().error).toBe('שגיאה בטעינת הנתונים');
    });
  });

  describe('fetchVotingHistory', () => {
    it('should set loading state while fetching', async () => {
      (usersApi.getVotingHistory as jest.Mock).mockImplementation(() => {
        expect(useUserStore.getState().isLoading).toBe(true);
        return Promise.resolve(mockVotingHistory);
      });

      await useUserStore.getState().fetchVotingHistory();
    });

    it('should populate voting history on successful fetch', async () => {
      (usersApi.getVotingHistory as jest.Mock).mockResolvedValue(mockVotingHistory);

      await useUserStore.getState().fetchVotingHistory();

      expect(useUserStore.getState().votingHistory).toEqual(mockVotingHistory);
      expect(useUserStore.getState().isLoading).toBe(false);
    });

    it('should set error on fetch failure', async () => {
      (usersApi.getVotingHistory as jest.Mock).mockRejectedValue(new Error('Network error'));

      await useUserStore.getState().fetchVotingHistory();

      expect(useUserStore.getState().votingHistory).toEqual([]);
      expect(useUserStore.getState().error).toBe('Network error');
    });

    it('should set Hebrew error for non-Error exceptions', async () => {
      (usersApi.getVotingHistory as jest.Mock).mockRejectedValue(null);

      await useUserStore.getState().fetchVotingHistory();

      expect(useUserStore.getState().error).toBe('שגיאה בטעינת הנתונים');
    });
  });

  describe('refreshUserData', () => {
    it('should fetch both token balance and voting history', async () => {
      (usersApi.getTokenBalance as jest.Mock).mockResolvedValue(mockTokenBalance);
      (usersApi.getVotingHistory as jest.Mock).mockResolvedValue(mockVotingHistory);

      await useUserStore.getState().refreshUserData();

      expect(usersApi.getTokenBalance).toHaveBeenCalled();
      expect(usersApi.getVotingHistory).toHaveBeenCalled();
      expect(useUserStore.getState().tokenBalance).toEqual(mockTokenBalance);
      expect(useUserStore.getState().votingHistory).toEqual(mockVotingHistory);
    });

    it('should fetch both concurrently', async () => {
      let balanceCallTime = 0;
      let historyCallTime = 0;

      (usersApi.getTokenBalance as jest.Mock).mockImplementation(() => {
        balanceCallTime = Date.now();
        return Promise.resolve(mockTokenBalance);
      });

      (usersApi.getVotingHistory as jest.Mock).mockImplementation(() => {
        historyCallTime = Date.now();
        return Promise.resolve(mockVotingHistory);
      });

      await useUserStore.getState().refreshUserData();

      // Both should be called nearly simultaneously (within 50ms)
      expect(Math.abs(balanceCallTime - historyCallTime)).toBeLessThan(50);
    });

    it('should handle partial failures', async () => {
      (usersApi.getTokenBalance as jest.Mock).mockResolvedValue(mockTokenBalance);
      (usersApi.getVotingHistory as jest.Mock).mockRejectedValue(new Error('History error'));

      await useUserStore.getState().refreshUserData();

      // Token balance should succeed
      expect(useUserStore.getState().tokenBalance).toEqual(mockTokenBalance);
      // But voting history fails
      expect(useUserStore.getState().error).toBe('History error');
    });

    it('should handle complete failure', async () => {
      (usersApi.getTokenBalance as jest.Mock).mockRejectedValue(new Error('Balance error'));
      (usersApi.getVotingHistory as jest.Mock).mockRejectedValue(new Error('History error'));

      await useUserStore.getState().refreshUserData();

      expect(useUserStore.getState().tokenBalance).toBeNull();
      expect(useUserStore.getState().votingHistory).toEqual([]);
      // One of the errors should be set
      expect(useUserStore.getState().error).toBeDefined();
    });
  });
});
