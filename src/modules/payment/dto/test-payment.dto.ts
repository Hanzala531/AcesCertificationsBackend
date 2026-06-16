import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TestConfirmPaymentDto {
  @ApiProperty({
    example: 'pm_card_visa',
    description:
      'Stripe test payment method token. Use pm_card_visa for success, pm_card_chargeDeclined for failure, pm_card_authenticationRequired for 3D Secure',
    maxLength: 255,
    examples: {
      success: {
        value: 'pm_card_visa',
        summary: 'Visa (Success)',
      },
      declined: {
        value: 'pm_card_chargeDeclined',
        summary: 'Card Declined',
      },
      requires3dSecure: {
        value: 'pm_card_authenticationRequired',
        summary: 'Requires 3D Secure',
      },
    },
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  test_payment_method_token: string;
}
