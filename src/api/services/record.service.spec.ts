import { Test, TestingModule } from '@nestjs/testing';
import { RecordService } from './record.service';
import { getModelToken } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Record } from '../schemas/record.schema';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

// Mock the global fetch
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: () =>
      Promise.resolve(`
      <metadata>
        <release>
          <title>Abbey Road</title>
          <artist-credit>
            <name-credit>
              <artist>
                <name>The Beatles</name>
              </artist>
            </name-credit>
          </artist-credit>
          <media>
            <track-list>
              <track>
                <position>1</position>
                <recording>
                  <title>Come Together</title>
                </recording>
                <length>259733</length>
              </track>
            </track-list>
          </media>
        </release>
      </metadata>
    `),
  }),
);

describe('RecordService', () => {
  let service: RecordService;
  let mockModel: any;
  let mockCacheManager: any;
  let mockHttpService: any;

  beforeEach(async () => {
    mockModel = {
      new: jest.fn().mockResolvedValue({}),
      constructor: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({}),
      }),
      create: jest.fn().mockResolvedValue({}),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };

    mockCacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    mockHttpService = {
      get: jest.fn().mockReturnValue(
        of({
          data: {
            artist: 'The Beatles',
            album: 'Abbey Road',
          },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordService,
        {
          provide: getModelToken(Record.name),
          useValue: mockModel,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<RecordService>(RecordService);

    // Reset fetch mock for each test
    (global.fetch as jest.Mock).mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch data from external service', async () => {
    const result = await service.fetchMusicBrainzDataPublic('test-mbid');
    expect(result).toBeDefined();
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should create a record', async () => {
    const createRecordDto = {
      artist: 'The Beatles',
      album: 'Abbey Road',
      price: 25,
      qty: 10,
      format: RecordFormat.VINYL,
      category: RecordCategory.ROCK,
      trackList: [
        {
          title: 'Come Together',
          position: '1',
          duration: 259733,
        },
      ],
    };

    mockModel.create.mockResolvedValue({
      _id: 'someId',
      ...createRecordDto,
    });

    const result = await service.create(createRecordDto);
    expect(result).toBeDefined();
    expect(result.artist).toBe('The Beatles');
    expect(result.album).toBe('Abbey Road');
  });

  it('should fetch MusicBrainz data', async () => {
    const result = await service.fetchMusicBrainzDataPublic('test-mbid');
    expect(result).toBeDefined();
    expect(result.artist).toBe('The Beatles');
    expect(result.album).toBe('Abbey Road');
  });
});
