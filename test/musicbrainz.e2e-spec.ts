import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RecordFormat, RecordCategory } from '../src/api/schemas/record.enum';
import { Model } from 'mongoose';
import { RecordService } from '../src/api/services/record.service';
import { Record } from '../src/api/schemas/record.schema';
import { getModelToken } from '@nestjs/mongoose';

describe('MusicBrainz Integration (e2e)', () => {
  let app: INestApplication;
  let recordService: RecordService;
  let recordModel: Model<Record>;
  let createdRecordId: string;

  // Use a real MusicBrainz ID for testing
  const mbid = '11af85e2-c272-4c59-a902-47f75141dc97'; // The Cure - Disintegration

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api'); // Add the API prefix to match the main app
    app.useGlobalPipes(new ValidationPipe());
    
    recordService = moduleFixture.get<RecordService>(RecordService);
    recordModel = moduleFixture.get<Model<Record>>(getModelToken('Record'));
    
    await app.init();
    
    // Mock the fetchMusicBrainzData method to avoid real API calls
    jest.spyOn(recordService as any, 'fetchMusicBrainzData').mockResolvedValue({
      artist: 'The Cure',
      album: 'Disintegration',
      trackList: [
        { title: 'Plainsong', position: '1', duration: 312345 },
        { title: 'Pictures of You', position: '2', duration: 438543 },
        { title: 'Closedown', position: '3', duration: 242342 },
      ],
    });
  });

  afterAll(async () => {
    // Clean up any created records
    if (createdRecordId) {
      await recordModel.findByIdAndDelete(createdRecordId);
    }
    
    await app.close();
  });

  it('should create a record with MusicBrainz data', async () => {
    const createRecordDto = {
      artist: 'The Cure',
      album: 'Disintegration',
      price: 25,
      qty: 10,
      format: RecordFormat.VINYL,
      category: RecordCategory.ALTERNATIVE,
      mbid,
    };

    const response = await request(app.getHttpServer())
      .post('/api/records')
      .send(createRecordDto)
      .expect(201);

    createdRecordId = response.body._id;

    // Verify that the record was created with track list
    expect(response.body).toHaveProperty('artist', 'The Cure');
    expect(response.body).toHaveProperty('album', 'Disintegration');
    expect(response.body).toHaveProperty('mbid', mbid);
    expect(response.body).toHaveProperty('trackList');
    expect(response.body.trackList).toBeInstanceOf(Array);
    expect(response.body.trackList.length).toBe(3);
    expect(response.body.trackList[0]).toHaveProperty('title', 'Plainsong');
  });

  it('should update a record with new MusicBrainz data', async () => {
    // First, let's modify our mock to return different data
    (recordService as any).fetchMusicBrainzData.mockResolvedValueOnce({
      artist: 'The Cure',
      album: 'Disintegration',
      trackList: [
        { title: 'Plainsong', position: '1', duration: 312345 },
        { title: 'Pictures of You', position: '2', duration: 438543 },
        { title: 'Closedown', position: '3', duration: 242342 },
        { title: 'Lovesong', position: '4', duration: 234234 }, // Additional track
      ],
    });

    // Now update the record
    const updateRecordDto = {
      price: 30, // Change price
      mbid, // Same MBID, but we'll mock different data
    };

    const response = await request(app.getHttpServer())
      .put(`/api/records/${createdRecordId}`)
      .send(updateRecordDto)
      .expect(200);

    // Verify the update
    expect(response.body).toHaveProperty('price', 30);
    expect(response.body).toHaveProperty('trackList');
    expect(response.body.trackList).toBeInstanceOf(Array);
    expect(response.body.trackList.length).toBe(4); // Should have 4 tracks now
    expect(response.body.trackList[3]).toHaveProperty('title', 'Lovesong');
  });

  it('should fetch MusicBrainz data directly via endpoint', async () => {
    // Mock the public method this time
    jest.spyOn(recordService, 'fetchMusicBrainzDataPublic').mockResolvedValueOnce({
      artist: 'The Cure',
      album: 'Disintegration',
      trackList: [
        { title: 'Plainsong', position: '1', duration: 312345 },
        { title: 'Pictures of You', position: '2', duration: 438543 },
      ],
    });

    const response = await request(app.getHttpServer())
      .get(`/api/records/mb/fetch/${mbid}`)
      .expect(200);

    // Verify the response contains the expected data
    expect(response.body).toHaveProperty('artist', 'The Cure');
    expect(response.body).toHaveProperty('album', 'Disintegration');
    expect(response.body).toHaveProperty('trackList');
    expect(response.body.trackList).toBeInstanceOf(Array);
    expect(response.body.trackList.length).toBe(2);
  });

  it('should find a record by MBID', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/records/mb/${mbid}`)
      .expect(200);

    // Verify the response contains the expected data
    expect(response.body).toHaveProperty('artist', 'The Cure');
    expect(response.body).toHaveProperty('album', 'Disintegration');
    expect(response.body).toHaveProperty('mbid', mbid);
  });
}); 