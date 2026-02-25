import { writeFileSync } from 'fs';

const collection = {
  info: {
    name: 'SentinelOne MVP',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [
    {
      name: 'Login',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        url: '{{baseUrl}}/auth/login',
        body: { mode: 'raw', raw: JSON.stringify({ email: 'admin@democorp.test', password: 'Password123!', orgName: 'DemoCorp' }, null, 2) },
      },
    },
    {
      name: 'Run CNAPP Scan',
      request: {
        method: 'POST',
        header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
        url: '{{baseUrl}}/cnapp/scan',
      },
    },
  ],
};

writeFileSync('postman_collection.json', JSON.stringify(collection, null, 2));