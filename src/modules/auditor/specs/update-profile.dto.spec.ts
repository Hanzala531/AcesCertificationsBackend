import { validate } from 'class-validator';
import { AssignCertificateDto } from '../dto/update-profile.dto';

describe('AssignCertificateDto', () => {
  it('should fail validation when certificate_ids contains non-UUID strings', async () => {
    const dto = new AssignCertificateDto();
    dto.certificate_ids = ['cert-4'];
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('certificate_ids');
    expect(errors[0].constraints).toHaveProperty('isUuid');
  });

  it('should pass validation when certificate_ids contains valid UUIDs', async () => {
    const dto = new AssignCertificateDto();
    dto.certificate_ids = ['550e8400-e29b-41d4-a716-446655440000'];
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
