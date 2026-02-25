import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { AppModule } from './app.module';

async function run() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder().setTitle('SentinelOne MVP API').setVersion('0.1.0').addBearerAuth().build();
  const doc = SwaggerModule.createDocument(app, config);
  writeFileSync('openapi.json', JSON.stringify(doc, null, 2));
  await app.close();
}

run();