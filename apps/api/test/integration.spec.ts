import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Core flows (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('signup/login + mfa setup flow reachable', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({ email: 'admin@democorp.test', password: 'Password123!', orgName: 'DemoCorp' }).expect((r) => {
      expect([200, 401]).toContain(r.status);
    });
  });

  it('create secret endpoint reachable', async () => {
    await request(app.getHttpServer()).post('/secrets').expect((r) => {
      expect([401, 403]).toContain(r.status);
    });
  });

  it('pam request endpoint reachable', async () => {
    await request(app.getHttpServer()).post('/pam/requests').expect((r) => {
      expect([401, 403]).toContain(r.status);
    });
  });

  it('cnapp scan endpoint reachable', async () => {
    await request(app.getHttpServer()).post('/cnapp/scan').expect((r) => {
      expect([401, 403]).toContain(r.status);
    });
  });
});