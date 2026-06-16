import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface AuthResponse {
  user: {
    id?: string;
    email: string;
    role: string;
    [key: string]: unknown;
  };
  tokens: {
    access_token: string;
    refresh_token: string;
  };
}

describe('Auth API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait for database to be ready and migrations to run
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', () => {
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: 'password123',
        role: 'user',
      };

      return request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201)
        .expect((res) => {
          const body = res.body as AuthResponse;
          expect(body).toHaveProperty('user');
          expect(body).toHaveProperty('tokens');
          expect(body.user.email).toBe(userData.email);
          expect(body.user.role).toBe(userData.role);
          expect(body.tokens).toHaveProperty('access_token');
          expect(body.tokens).toHaveProperty('refresh_token');
        });
    });

    it('should register user with default role when role not provided', () => {
      const userData = {
        email: `test2-${Date.now()}@example.com`,
        password: 'password123',
      };

      return request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201)
        .expect((res) => {
          const body = res.body as AuthResponse;
          expect(body.user.role).toBe('user');
        });
    });

    it('should fail registration with invalid email', () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
      };

      return request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(400);
    });

    it('should fail registration with short password', () => {
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: '123',
      };

      return request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(400);
    });

    it('should fail registration without required fields', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({})
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    const testEmail = `login-${Date.now()}@example.com`;
    const testPassword = 'password123';

    beforeAll(async () => {
      // Register a user for login tests
      const userData = {
        email: testEmail,
        password: testPassword,
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);
    });

    it('should login successfully with correct credentials', () => {
      const loginData = {
        email: testEmail,
        password: testPassword,
      };

      return request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(201)
        .expect((res) => {
          const body = res.body as AuthResponse;
          expect(body).toHaveProperty('user');
          expect(body).toHaveProperty('tokens');
          expect(body.user.email).toBe(loginData.email);
          expect(body.tokens).toHaveProperty('access_token');
          expect(body.tokens).toHaveProperty('refresh_token');
        });
    });

    it('should fail login with wrong password', () => {
      const loginData = {
        email: testEmail,
        password: 'wrongpassword',
      };

      return request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(401);
    });

    it('should fail login with non-existent email', () => {
      const loginData = {
        email: `nonexistent-${Date.now()}@example.com`,
        password: 'password123',
      };

      return request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(401);
    });

    it('should fail login without credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      // Register and login to get refresh token
      const userData = {
        email: `refresh-${Date.now()}@example.com`,
        password: 'password123',
      };

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      refreshToken = (registerResponse.body as AuthResponse).tokens
        .refresh_token;
    });

    it('should refresh tokens successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(201)
        .expect((res) => {
          const body = res.body as AuthResponse;
          expect(body).toHaveProperty('user');
          expect(body).toHaveProperty('tokens');
          expect(body.tokens).toHaveProperty('access_token');
          expect(body.tokens).toHaveProperty('refresh_token');
          expect(body.tokens.refresh_token).not.toBe(refreshToken); // Should be new
        });
    });

    it('should fail refresh with invalid token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'invalid-token' })
        .expect(401);
    });

    it('should fail refresh without token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(400);
    });
  });

  describe('POST /auth/logout', () => {
    let userId: string;

    beforeAll(async () => {
      // Register and login to get user ID
      const userData = {
        email: `logout-${Date.now()}@example.com`,
        password: 'password123',
      };

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      userId = (registerResponse.body as AuthResponse).user.id as string;
    });

    it('should logout successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .send({ userId: userId })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('ok', true);
        });
    });

    it('should fail logout without userId', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .send({})
        .expect(400);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full auth flow: register -> login -> refresh -> logout', async () => {
      const userData = {
        email: `fullflow-${Date.now()}@example.com`,
        password: 'password123',
      };

      // 1. Register
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      const userId = (registerResponse.body as AuthResponse).user.id as string;
      let refreshToken = (registerResponse.body as AuthResponse).tokens
        .refresh_token;

      // 2. Login
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userData)
        .expect(201);

      expect((loginResponse.body as AuthResponse).user.id).toBe(userId);

      // 3. Refresh token
      const refreshResponse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(201);

      refreshToken = (refreshResponse.body as AuthResponse).tokens
        .refresh_token;

      // 4. Logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ userId: userId })
        .expect(201);
    });

    it('should allow admin to create subadmin and include role in response', async () => {
      const adminEmail = `admin-${Date.now()}@example.com`;
      const adminPassword = 'AdminPass123!';

      // Create admin publicly
      await request(app.getHttpServer())
        .post('/auth/register-admin-public')
        .send({ email: adminEmail, password: adminPassword })
        .expect(201);

      // Login as admin and get access token
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: adminEmail, password: adminPassword })
        .expect(201);

      const accessToken = (loginRes.body as AuthResponse).tokens.access_token;

      // Create subadmin
      const subadminEmail = `subadmin-${Date.now()}@example.com`;
      const subResp = await request(app.getHttpServer())
        .post('/auth/register-subadmin')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: subadminEmail, first_name: 'Jane', last_name: 'Smith' })
        .expect(201);

      expect(subResp.body).toHaveProperty('role');
      expect(subResp.body.role).toBe('subadmin');
    });
  });
});
