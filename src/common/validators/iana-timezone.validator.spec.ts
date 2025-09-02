import { IsIanaTimeZoneConstraint } from './iana-timezone.validator';

describe('IsIanaTimeZoneConstraint', () => {
  const c = new IsIanaTimeZoneConstraint();
  it('acepta timezones válidos', () => {
    expect(c.validate('Europe/Madrid')).toBe(true);
    expect(c.validate('UTC')).toBe(true);
  });
  it('rechaza timezones inválidos', () => {
    expect(c.validate('Europe/NoExiste')).toBe(false);
    expect(c.validate('abc')).toBe(false);
    expect(c.validate(123 as unknown as string)).toBe(false);
  });
});
