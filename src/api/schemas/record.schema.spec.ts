import { Record, RecordSchema } from './record.schema';
import { RecordCategory, RecordFormat } from './record.enum';
import { Model } from 'mongoose';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';

describe('Record Schema', () => {
  let model: Model<Record>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot('mongodb://localhost/test'),
        MongooseModule.forFeature([{ name: 'Record', schema: RecordSchema }]),
      ],
    }).compile();

    model = module.get<Model<Record>>(getModelToken('Record'));
  });

  it('should create a valid record', () => {
    const record = new model({
      artist: 'The Beatles',
      album: 'Abbey Road',
      price: 25,
      qty: 10,
      format: RecordFormat.VINYL,
      category: RecordCategory.ROCK,
      mbid: 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d',
      trackList: [
        {
          title: 'Come Together',
          position: '1',
          duration: 259733,
        },
      ],
    });

    expect(record).toBeDefined();
    expect(record.artist).toBe('The Beatles');
    expect(record.album).toBe('Abbey Road');
    expect(record.price).toBe(25);
    expect(record.qty).toBe(10);
    expect(record.format).toBe(RecordFormat.VINYL);
    expect(record.category).toBe(RecordCategory.ROCK);
    expect(record.mbid).toBe('b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
    expect(record.trackList).toHaveLength(1);
    expect(record.trackList[0].title).toBe('Come Together');
    expect(record.trackList[0].position).toBe('1');
    expect(record.trackList[0].duration).toBe(259733);
  });

  it('should validate required fields', async () => {
    const record = new model({});
    let err;
    try {
      await record.validate();
    } catch (error) {
      err = error;
    }
    expect(err).toBeDefined();
    expect(err.errors.artist).toBeDefined();
    expect(err.errors.album).toBeDefined();
    expect(err.errors.price).toBeDefined();
    expect(err.errors.qty).toBeDefined();
    expect(err.errors.format).toBeDefined();
    expect(err.errors.category).toBeDefined();
  });

  it('should validate format enum', async () => {
    const record = new model({
      artist: 'The Beatles',
      album: 'Abbey Road',
      price: 25,
      qty: 10,
      format: 'INVALID_FORMAT',
      category: RecordCategory.ROCK,
    });

    let err;
    try {
      await record.validate();
    } catch (error) {
      err = error;
    }
    expect(err).toBeDefined();
    expect(err.errors.format).toBeDefined();
  });

  it('should validate category enum', async () => {
    const record = new model({
      artist: 'The Beatles',
      album: 'Abbey Road',
      price: 25,
      qty: 10,
      format: RecordFormat.VINYL,
      category: 'INVALID_CATEGORY',
    });

    let err;
    try {
      await record.validate();
    } catch (error) {
      err = error;
    }
    expect(err).toBeDefined();
    expect(err.errors.category).toBeDefined();
  });

  it('should set default timestamps', () => {
    const record = new model({
      artist: 'The Beatles',
      album: 'Abbey Road',
      price: 25,
      qty: 10,
      format: RecordFormat.VINYL,
      category: RecordCategory.ROCK,
    });

    expect(record.created).toBeDefined();
    expect(record.lastModified).toBeDefined();
  });

  it('should set default empty track list', () => {
    const record = new model({
      artist: 'The Beatles',
      album: 'Abbey Road',
      price: 25,
      qty: 10,
      format: RecordFormat.VINYL,
      category: RecordCategory.ROCK,
    });

    expect(record.trackList).toBeDefined();
    expect(Array.isArray(record.trackList)).toBe(true);
    expect(record.trackList).toHaveLength(0);
  });
});
