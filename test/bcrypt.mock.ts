// Mock for bcrypt
export const hash = jest.fn().mockResolvedValue('hashed-password');
export const compare = jest.fn().mockResolvedValue(true);
