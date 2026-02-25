import { Controller, Get, Header } from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';

collectDefaultMetrics();

@Controller()
export class MetricsController {
  @Get('metrics')
  @Header('Content-Type', register.contentType)
  metrics() {
    return register.metrics();
  }
}