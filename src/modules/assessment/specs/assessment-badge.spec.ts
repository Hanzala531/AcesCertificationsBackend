import { AssessmentRepository } from '../assessment.repository';
import { DatabaseService } from '../../../database/database.service';

describe('Assessment Badge Logic', () => {
  let repo: AssessmentRepository;
  let db: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    db = { query: jest.fn() } as any;
    repo = new AssessmentRepository(db);
  });

  describe('getAssuredSlotForOrg', () => {
    it('should return slot 2 when org has Bronze self-disclosure badge', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ color: '#CD7F32' }],
        rowCount: 1,
      } as any);

      const slot = await repo.getAssuredSlotForOrg('cert-1', 'org-1');
      expect(slot).toBe(2);
    });

    it('should return slot 3 when org has Silver self-disclosure badge', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ color: '#C0C0C0' }],
        rowCount: 1,
      } as any);

      const slot = await repo.getAssuredSlotForOrg('cert-1', 'org-1');
      expect(slot).toBe(3);
    });

    it('should return slot 3 when org has Gold self-disclosure badge', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ color: '#FFD700' }],
        rowCount: 1,
      } as any);

      const slot = await repo.getAssuredSlotForOrg('cert-1', 'org-1');
      expect(slot).toBe(3);
    });

    it('should return slot 3 when org has Emerald self-disclosure badge', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ color: '#00C853' }],
        rowCount: 1,
      } as any);

      const slot = await repo.getAssuredSlotForOrg('cert-1', 'org-1');
      expect(slot).toBe(3);
    });

    it('should return null when org has no self-disclosure badge', async () => {
      db.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const slot = await repo.getAssuredSlotForOrg('cert-1', 'org-1');
      expect(slot).toBeNull();
    });
  });

  describe('getBadgeForScore - self_disclosure', () => {
    it('should query slot 1 for self_disclosure', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'badge-1', name: 'ACES Rated' }],
        rowCount: 1,
      } as any);

      const result = await repo.getBadgeForScore(
        'cert-1',
        65,
        'self_disclosure',
      );
      expect(result).toEqual({ id: 'badge-1', name: 'ACES Rated' });

      const queryText = db.query.mock.calls[0][0] as string;
      expect(queryText).toContain("($3 = 'self_disclosure' AND b.slot = 1)");
    });
  });

  describe('getBadgeForScore - assured', () => {
    it('should query slot 2 when org has Bronze self-disclosure (lowest tier)', async () => {
      // First call: getAssuredSlotForOrg query
      db.query.mockResolvedValueOnce({
        rows: [{ color: '#CD7F32' }],
        rowCount: 1,
      } as any);

      // Second call: badge lookup with slot 2
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'badge-verified', name: 'ACES Verified' }],
        rowCount: 1,
      } as any);

      const result = await repo.getBadgeForScore('cert-1', 90, 'assured', 'org-1');
      expect(result).toEqual({ id: 'badge-verified', name: 'ACES Verified' });

      // Verify the badge query used slot 2
      const badgeQueryArgs = db.query.mock.calls[1];
      expect(badgeQueryArgs[1]).toContain(2); // slot 2
    });

    it('should query slot 3 when org has Silver self-disclosure (higher tier)', async () => {
      // First call: getAssuredSlotForOrg returns Silver color
      db.query.mockResolvedValueOnce({
        rows: [{ color: '#C0C0C0' }],
        rowCount: 1,
      } as any);

      // Second call: badge lookup with slot 3
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'badge-certified', name: 'ACES Certified' }],
        rowCount: 1,
      } as any);

      const result = await repo.getBadgeForScore('cert-1', 90, 'assured', 'org-1');
      expect(result).toEqual({ id: 'badge-certified', name: 'ACES Certified' });

      // Verify the badge query used slot 3
      const badgeQueryArgs = db.query.mock.calls[1];
      expect(badgeQueryArgs[1]).toContain(3); // slot 3
    });

    it('should query slot 3 when org has Gold self-disclosure', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ color: '#FFD700' }],
        rowCount: 1,
      } as any);

      db.query.mockResolvedValueOnce({
        rows: [{ id: 'badge-certified', name: 'ACES Certified' }],
        rowCount: 1,
      } as any);

      const result = await repo.getBadgeForScore('cert-1', 75, 'assured', 'org-1');
      expect(result).toEqual({ id: 'badge-certified', name: 'ACES Certified' });
    });

    it('falls back to slot 2 when Silver/Gold disclosure but score does not fit any slot 3 color band', async () => {
      // First call: getAssuredSlotForOrg → Silver disclosure → slot 3 path
      db.query.mockResolvedValueOnce({
        rows: [{ color: '#C0C0C0' }],
        rowCount: 1,
      } as any);

      // Second call: slot 3 lookup returns no match (score too low for any slot 3 band)
      db.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      // Third call: slot 2 fallback returns the verified badge
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'badge-verified', name: 'ACES Verified' }],
        rowCount: 1,
      } as any);

      const result = await repo.getBadgeForScore('cert-1', 60, 'assured', 'org-1');
      expect(result).toEqual({ id: 'badge-verified', name: 'ACES Verified' });

      expect(db.query).toHaveBeenCalledTimes(3);
      // Slot tried first was 3
      expect(db.query.mock.calls[1][1]).toContain(3);
      // Fallback was 2
      expect(db.query.mock.calls[2][1]).toContain(2);
    });

    it('returns null when Bronze disclosure and score does not fit slot 2 (no fallback up the ladder)', async () => {
      // Bronze → slot 2 only, no upward fallback
      db.query.mockResolvedValueOnce({
        rows: [{ color: '#CD7F32' }],
        rowCount: 1,
      } as any);
      db.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await repo.getBadgeForScore('cert-1', 30, 'assured', 'org-1');
      expect(result).toBeNull();
      expect(db.query).toHaveBeenCalledTimes(2); // no third query
    });

    it('should return null when org has no self-disclosure badge (not qualified)', async () => {
      db.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await repo.getBadgeForScore('cert-1', 80, 'assured', 'org-1');
      expect(result).toBeNull();

      // Should only have made 1 query (getAssuredSlotForOrg), not the badge lookup
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('should fall back to generic assured logic when no organizationId provided', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'badge-any', name: 'ACES Verified' }],
        rowCount: 1,
      } as any);

      const result = await repo.getBadgeForScore('cert-1', 80, 'assured');
      expect(result).toEqual({ id: 'badge-any', name: 'ACES Verified' });

      // Should NOT have called getAssuredSlotForOrg
      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });
});
