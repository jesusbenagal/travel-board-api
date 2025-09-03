import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null;
const isString = (v: unknown): v is string => typeof v === 'string';
const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every(isString);

@Injectable()
export class PublicShareThrottleGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const raw: unknown = req;
    const r: Rec = isRecord(raw) ? raw : {};

    const headersVal = r['headers'];
    const headers = isRecord(headersVal) ? headersVal : undefined;

    const xffVal = headers?.['x-forwarded-for'];
    const xff = isString(xffVal) ? xffVal.split(',')[0].trim() : undefined;

    const ipVal = r['ip'];
    const ipsVal = r['ips'];
    const connVal = r['connection'];
    const sockVal = r['socket'];

    const ip =
      xff ??
      (isString(ipVal) ? ipVal : undefined) ??
      (isStringArray(ipsVal) && ipsVal.length ? ipsVal[0] : undefined) ??
      (isRecord(connVal) && isString(connVal['remoteAddress'])
        ? connVal['remoteAddress']
        : undefined) ??
      (isRecord(sockVal) && isString(sockVal['remoteAddress'])
        ? sockVal['remoteAddress']
        : undefined) ??
      '';

    const paramsVal = r['params'];
    const slug =
      isRecord(paramsVal) && isString(paramsVal['slug'])
        ? paramsVal['slug']
        : '';

    return Promise.resolve(`${ip}|${slug}`);
  }
}
