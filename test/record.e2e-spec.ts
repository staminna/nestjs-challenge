import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RecordFormat, RecordCategory } from '../src/api/schemas/record.enum';

describe('RecordController (e2e)', () => {
  let app: INestApplication;
  let recordId: string;
  let recordModel;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api'); // Set prefix to match the actual application
    app.useGlobalPipes(new ValidationPipe());
    recordModel = app.get('RecordModel');
    await app.init();
  });

  // Test to create a record
  it('should create a new record', async () => {
    const createRecordDto = {
      artist: 'The Beatles',
      album: 'Abbey Road',
      price: 25,
      qty: 10,
      format: RecordFormat.VINYL,
      category: RecordCategory.ROCK,
    };

    const response = await request(app.getHttpServer())
      .post('/api/records')
      .send(createRecordDto)
      .expect(201);

    recordId = response.body._id;
    expect(response.body).toHaveProperty('artist', 'The Beatles');
    expect(response.body).toHaveProperty('album', 'Abbey Road');
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

    recordId = createResponse.body._id;

    const response = await request(app.getHttpServer())
      .get('/api/records?artist=The Fake Band')
      .expect(200);
    
    // Response format changed to include pagination
    expect(response.body.records).toBeDefined();
    expect(response.body.records.length).toBe(1);
    expect(response.body.records[0]).toHaveProperty('artist', 'The Fake Band');
  });
  
  afterEach(async () => {
    if (recordId) {
      await recordModel.findByIdAndDelete(recordId);
    }
  });

  afterAll(async () => {
    await app.close();
  });
});
