import { Test, TestingModule } from '@nestjs/testing';
import { PasswordGeneratorService } from '../services/password-generator.service';

describe('PasswordGeneratorService', () => {
  let service: PasswordGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordGeneratorService],
    }).compile();

    service = module.get<PasswordGeneratorService>(PasswordGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate', () => {
    it('should generate a password between 6-7 characters', () => {
      for (let i = 0; i < 100; i++) {
        const password = service.generate();
        expect(password.length).toBeGreaterThanOrEqual(6);
        expect(password.length).toBeLessThanOrEqual(7);
      }
    });

    it('should generate a password with at least 4 alphabetic characters', () => {
      for (let i = 0; i < 100; i++) {
        const password = service.generate();
        const alphabeticCount = (password.match(/[A-Za-z]/g) || []).length;
        expect(alphabeticCount).toBeGreaterThanOrEqual(4);
      }
    });

    it('should generate a password with at least 1 numeric digit', () => {
      for (let i = 0; i < 100; i++) {
        const password = service.generate();
        expect(/[0-9]/.test(password)).toBe(true);
      }
    });

    it('should generate a password with at least 1 special symbol', () => {
      for (let i = 0; i < 100; i++) {
        const password = service.generate();
        expect(/[!@#$%^&*_+=-]/.test(password)).toBe(true);
      }
    });

    it('should generate random passwords (not predictable)', () => {
      const passwords = new Set<string>();
      for (let i = 0; i < 50; i++) {
        passwords.add(service.generate());
      }
      expect(passwords.size).toBeGreaterThan(45);
    });
  });

  describe('validate', () => {
    it('should validate generated passwords', () => {
      for (let i = 0; i < 50; i++) {
        const password = service.generate();
        expect(service.validate(password)).toBe(true);
      }
    });

    it('should reject passwords shorter than 6 characters', () => {
      expect(service.validate('Abc1!')).toBe(false);
      expect(service.validate('Ab1')).toBe(false);
    });

    it('should reject passwords longer than 7 characters', () => {
      expect(service.validate('Abc1!De2')).toBe(false);
    });

    it('should reject passwords without numeric digit', () => {
      expect(service.validate('Abc!De')).toBe(false);
    });

    it('should reject passwords without special symbol', () => {
      expect(service.validate('Abc1De')).toBe(false);
    });

    it('should reject passwords with fewer than 4 alphabetic characters', () => {
      expect(service.validate('Ab1!2')).toBe(false);
    });

    it('should accept valid passwords', () => {
      expect(service.validate('Abc1!De')).toBe(true);
      expect(service.validate('XyZ9$Wx')).toBe(true);
    });
  });
});
