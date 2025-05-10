import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RecordFormat, RecordCategory } from '../src/api/schemas/record.enum';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { Record } from '../src/api/schemas/record.schema';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('RecordController (e2e)', () => {
  let app: INestApplication;
  let recordId: string;
  let recordModel: Model<Record>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CACHE_MANAGER)
      .useValue({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api'); // Set prefix to match the actual application
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    recordModel = moduleFixture.get<Model<Record>>(getModelToken('Record'));
    await app.init();

    // Create test record for subsequent tests
    const createRecordDto = {
      artist: 'The Beatles',
      album: 'Abbey Road',
      price: 25,
      qty: 10,
      format: RecordFormat.VINYL,
      category: RecordCategory.ROCK,
    };

    const record = await recordModel.create(createRecordDto);
    recordId = record._id.toString();
  });

  it('should fetch a record with filters', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/records?artist=The Beatles')
      .expect(200);

    // Response format changed to include pagination
    expect(response.body.records).toBeDefined();
    expect(Array.isArray(response.body.records)).toBe(true);
    // At least one record with The Beatles should be found
    expect(response.body.records.some((r) => r.artist === 'The Beatles')).toBe(
      true,
    );
  });

  it('should create a new record and fetch it with filters', async () => {
    const createRecordDto = {
      artist: 'The Fake Band',
      album: 'Fake Album',
      price: 25,
      qty: 10,
      format: RecordFormat.VINYL,
      category: RecordCategory.ROCK,
    };

    const createResponse = await request(app.getHttpServer())
      .post('/api/records')
      .send(createRecordDto)
      .expect(201);

    const newRecordId = createResponse.body._id;

    const response = await request(app.getHttpServer())
      .get('/api/records?artist=The Fake Band')
      .expect(200);

    // Response format changed to include pagination
    expect(response.body.records).toBeDefined();
    expect(
      response.body.records.some((r) => r.artist === 'The Fake Band'),
    ).toBe(true);

    // Cleanup the newly created record
    await recordModel.findByIdAndDelete(newRecordId);
  });

  afterAll(async () => {
    // Cleanup created record
    if (recordId) {
      await recordModel.findByIdAndDelete(recordId);
    }
    await app.close();
  });
});
