import { useVotesStore } from '../../stores/votesStore';
import { votesApi } from '@sync/api-client';

// Mock the API client
jest.mock('@sync/api-client', () => ({
  votesApi: {
    getVotes: jest.fn(),
    getActiveVotes: jest.fn(),
  },
}));

describe('Votes Store', () => {
  const mockVotes = [
    {
      id: 'vote-1',
      title: 'Test Vote 1',
      description: 'Description 1',
      status: 'active',
      municipality: 'kiryat-tivon',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'vote-2',
      title: 'Test Vote 2',
      description: 'Description 2',
      status: 'ended',
      municipality: 'kiryat-tivon',
      createdAt: new Date().toISOString(),
    },
  ];

  const mockActiveVotes = [mockVotes[0]];

  beforeEach(() => {
    // Reset the store state before each test
    useVotesStore.setState({
      votes: [],
      activeVotes: [],
      isLoading: false,
      error: null,
      selectedFilter: 'all',
      searchQuery: '',
    });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useVotesStore.getState();

      expect(state.votes).toEqual([]);
      expect(state.activeVotes).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.selectedFilter).toBe('all');
      expect(state.searchQuery).toBe('');
    });
  });

  describe('fetchVotes', () => {
    it('should set loading state while fetching', async () => {
      (votesApi.getVotes as jest.Mock).mockImplementation(() => {
        // Check loading state during fetch
        expect(useVotesStore.getState().isLoading).toBe(true);
        return Promise.resolve(mockVotes);
      });

      await useVotesStore.getState().fetchVotes();
    });

    it('should populate votes on successful fetch', async () => {
      (votesApi.getVotes as jest.Mock).mockResolvedValue(mockVotes);

      await useVotesStore.getState().fetchVotes();

      expect(useVotesStore.getState().votes).toEqual(mockVotes);
      expect(useVotesStore.getState().isLoading).toBe(false);
      expect(useVotesStore.getState().error).toBeNull();
    });

    it('should set error on fetch failure', async () => {
      (votesApi.getVotes as jest.Mock).mockRejectedValue(new Error('Network error'));

      await useVotesStore.getState().fetchVotes();

      expect(useVotesStore.getState().votes).toEqual([]);
      expect(useVotesStore.getState().isLoading).toBe(false);
      expect(useVotesStore.getState().error).toBe('Network error');
    });

    it('should set Hebrew error message for non-Error exceptions', async () => {
      (votesApi.getVotes as jest.Mock).mockRejectedValue('Unknown error');

      await useVotesStore.getState().fetchVotes();

      expect(useVotesStore.getState().error).toBe('שגיאה בטעינת ההצבעות');
    });
  });

  describe('fetchActiveVotes', () => {
    it('should populate active votes on successful fetch', async () => {
      (votesApi.getActiveVotes as jest.Mock).mockResolvedValue(mockActiveVotes);

      await useVotesStore.getState().fetchActiveVotes();

      expect(useVotesStore.getState().activeVotes).toEqual(mockActiveVotes);
      expect(useVotesStore.getState().isLoading).toBe(false);
    });

    it('should set error on fetch failure', async () => {
      (votesApi.getActiveVotes as jest.Mock).mockRejectedValue(new Error('API Error'));

      await useVotesStore.getState().fetchActiveVotes();

      expect(useVotesStore.getState().activeVotes).toEqual([]);
      expect(useVotesStore.getState().error).toBe('API Error');
    });
  });

  describe('setFilter', () => {
    it('should update selected filter', () => {
      useVotesStore.getState().setFilter('active');
      expect(useVotesStore.getState().selectedFilter).toBe('active');

      useVotesStore.getState().setFilter('ended');
      expect(useVotesStore.getState().selectedFilter).toBe('ended');

      useVotesStore.getState().setFilter('pending');
      expect(useVotesStore.getState().selectedFilter).toBe('pending');

      useVotesStore.getState().setFilter('all');
      expect(useVotesStore.getState().selectedFilter).toBe('all');
    });
  });

  describe('setSearchQuery', () => {
    it('should update search query', () => {
      useVotesStore.getState().setSearchQuery('תכנון');
      expect(useVotesStore.getState().searchQuery).toBe('תכנון');

      useVotesStore.getState().setSearchQuery('');
      expect(useVotesStore.getState().searchQuery).toBe('');
    });
  });

  describe('getVoteById', () => {
    it('should return vote from votes array', () => {
      useVotesStore.setState({ votes: mockVotes });

      const vote = useVotesStore.getState().getVoteById('vote-1');

      expect(vote).toBeDefined();
      expect(vote?.id).toBe('vote-1');
      expect(vote?.title).toBe('Test Vote 1');
    });

    it('should return vote from activeVotes if not in votes', () => {
      useVotesStore.setState({
        votes: [],
        activeVotes: mockActiveVotes,
      });

      const vote = useVotesStore.getState().getVoteById('vote-1');

      expect(vote).toBeDefined();
      expect(vote?.id).toBe('vote-1');
    });

    it('should return undefined if vote not found', () => {
      useVotesStore.setState({ votes: mockVotes, activeVotes: mockActiveVotes });

      const vote = useVotesStore.getState().getVoteById('non-existent');

      expect(vote).toBeUndefined();
    });
  });

  describe('refreshVotes', () => {
    it('should fetch both votes and active votes', async () => {
      (votesApi.getVotes as jest.Mock).mockResolvedValue(mockVotes);
      (votesApi.getActiveVotes as jest.Mock).mockResolvedValue(mockActiveVotes);

      await useVotesStore.getState().refreshVotes();

      expect(votesApi.getVotes).toHaveBeenCalled();
      expect(votesApi.getActiveVotes).toHaveBeenCalled();
      expect(useVotesStore.getState().votes).toEqual(mockVotes);
      expect(useVotesStore.getState().activeVotes).toEqual(mockActiveVotes);
    });

    it('should handle partial failures', async () => {
      (votesApi.getVotes as jest.Mock).mockResolvedValue(mockVotes);
      (votesApi.getActiveVotes as jest.Mock).mockRejectedValue(new Error('Partial error'));

      await useVotesStore.getState().refreshVotes();

      expect(useVotesStore.getState().votes).toEqual(mockVotes);
      expect(useVotesStore.getState().error).toBe('Partial error');
    });
  });
});
