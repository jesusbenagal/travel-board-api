import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsIanaTimeZoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.length < 3) return false;

    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
      return true;
    } catch {
      return false;
    }
  }
  defaultMessage(args?: ValidationArguments): string {
    return `${args?.property ?? 'timezone'} must be a valid IANA time zone (e.g., Europe/Madrid)`;
  }
}

export function IsIanaTimeZone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsIanaTimeZoneConstraint,
    });
  };
}
