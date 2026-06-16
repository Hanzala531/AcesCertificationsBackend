import { Injectable } from '@nestjs/common';

@Injectable()
export class PasswordGeneratorService {
  private readonly ALPHABETIC_CHARS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  private readonly NUMERIC_CHARS = '0123456789';
  private readonly SPECIAL_CHARS = '!@#$%^&*_-+=';

  generate(): string {
    const length = Math.random() < 0.5 ? 6 : 7;
    const numeric = this.getRandomChar(this.NUMERIC_CHARS);
    const special = this.getRandomChar(this.SPECIAL_CHARS);
    const remainingCount = length - 2;
    const alphabetic = Array.from({ length: remainingCount })
      .map(() => this.getRandomChar(this.ALPHABETIC_CHARS))
      .join('');

    const allChars = numeric + special + alphabetic;

    return this.shuffleString(allChars);
  }

  validate(password: string): boolean {
    if (!password || password.length < 6 || password.length > 7) {
      return false;
    }

    const hasAlphabetic = /[A-Za-z]/.test(password);
    const hasNumeric = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*_+=-]/.test(password);

    const alphabeticCount = (password.match(/[A-Za-z]/g) || []).length;

    return hasAlphabetic && hasNumeric && hasSpecial && alphabeticCount >= 4;
  }

  private getRandomChar(chars: string): string {
    const index = Math.floor(Math.random() * chars.length);
    return chars[index];
  }

  private shuffleString(str: string): string {
    const chars = str.split('');
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }
}
