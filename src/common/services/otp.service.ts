import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  generateOtp(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let otp = '';

    for (let i = 0; i < 6; i++) {
      const randomIndex = crypto.randomInt(0, characters.length);
      otp += characters.charAt(randomIndex);
    }

    return otp;
  }

  generateOtpExpiry(minutesFromNow: number = 2): Date {
    const now = new Date();
    return new Date(now.getTime() + minutesFromNow * 60000);
  }

  isOtpExpired(expiryTime: Date | string): boolean {
    const expiry =
      typeof expiryTime === 'string' ? new Date(expiryTime) : expiryTime;
    return new Date() > expiry;
  }

  verifyOtp(
    providedOtp: string,
    storedOtp: string | null,
    expiryTime: Date | string | null,
  ): boolean {
    if (!storedOtp || !expiryTime) {
      return false;
    }

    if (this.isOtpExpired(expiryTime)) {
      return false;
    }

    return providedOtp.toUpperCase() === storedOtp.toUpperCase();
  }
}
