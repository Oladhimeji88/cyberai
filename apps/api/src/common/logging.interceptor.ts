import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();
    const sanitize = (obj: any) => {
      if (!obj || typeof obj !== 'object') return obj;
      const out: any = Array.isArray(obj) ? [] : {};
      for (const [k, v] of Object.entries(obj)) {
        if (/password|secret|token|ciphertext|encrypted/i.test(k)) {
          out[k] = '[REDACTED]';
        } else if (typeof v === 'object') {
          out[k] = sanitize(v);
        } else {
          out[k] = v;
        }
      }
      return out;
    };
    return next.handle().pipe(
      tap(() => {
        const payload = {
          ts: new Date().toISOString(),
          method: req.method,
          path: req.url,
          status: context.switchToHttp().getResponse().statusCode,
          durationMs: Date.now() - start,
          body: sanitize(req.body),
        };
        console.log(JSON.stringify(payload));
      }),
    );
  }
}