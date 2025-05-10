import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RecordFormat, RecordCategory } from '../src/api/schemas/record.enum';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { Record } from '../src/api/schemas/record.schema';
import { Order } from '../src/api/schemas/order.schema';

describe('Order API (e2e)', () => {
  let app: INestApplication;
  let recordModel: Model<Record>;
  let orderModel: Model<Order>;
  let recordId: string;
  let orderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api'); // Add the API prefix to match the main app
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    recordModel = moduleFixture.get<Model<Record>>(getModelToken('Record'));
    orderModel = moduleFixture.get<Model<Order>>(getModelToken('Order'));

    await app.init();

    // Create a test record for orders
    const record = await recordModel.create({
      artist: 'Test Artist',
      album: 'Test Album',
      price: 19.99,
      qty: 10,
      format: RecordFormat.VINYL,
      category: RecordCategory.ROCK,
    });

    recordId = record._id.toString();
  });

  afterAll(async () => {
    // Clean up created records and orders
    await recordModel.deleteMany({});
    await orderModel.deleteMany({});
    await app.close();
  });

  it('should create an order', async () => {
    const createOrderDto = {
      recordId: recordId,
      quantity: 2,
    };

    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .send(createOrderDto)
      .expect(201);

    expect(response.body).toHaveProperty('recordId', recordId);
    expect(response.body).toHaveProperty('quantity', 2);
    expect(response.body).toHaveProperty('_id');

    orderId = response.body._id;

    // Verify record quantity was updated
    const updatedRecord = await recordModel.findById(recordId);
    expect(updatedRecord.qty).toBe(8); // Initial 10 - 2 ordered
  });

  it('should not create an order with invalid data', async () => {
    // Missing recordId
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({ quantity: 1 })
      .expect(400);

    // Invalid recordId format
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({ recordId: 'invalid-id', quantity: 1 })
      .expect(400);

    // Zero quantity
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({ recordId, quantity: 0 })
      .expect(400);

    // Non-existent record
    const nonExistentId = '60d21b4667d0d8992e610c85';
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({ recordId: nonExistentId, quantity: 1 })
      .expect(404);
  });

  it('should not create an order when insufficient stock', async () => {
    // Try to order more than available
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({ recordId, quantity: 9 }) // Only 8 left in stock
      .expect(400);
  });

  it('should get all orders', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/orders')
      .expect(200);

    expect(Array.isArray(response.body)).toBeTruthy();
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('recordId');
    expect(response.body[0]).toHaveProperty('quantity');
  });

  it('should get a specific order by ID', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .expect(200);

    expect(response.body).toHaveProperty('_id', orderId);
    expect(response.body).toHaveProperty('recordId', recordId);
    expect(response.body).toHaveProperty('quantity', 2);
  });

  it('should return 404 for non-existent order', async () => {
    const nonExistentId = '60d21b4667d0d8992e610c85';
    await request(app.getHttpServer())
      .get(`/api/orders/${nonExistentId}`)
      .expect(404);
  });
});
