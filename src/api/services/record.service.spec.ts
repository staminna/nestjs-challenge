import { Test, TestingModule } from '@nestjs/testing';
import { RecordService } from './record.service';
import { getModelToken } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Record } from '../schemas/record.schema';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';
import { Model } from 'mongoose';

// Mock data
const mockRecord = {
  _id: 'someId',
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
    {
      title: 'Something',
      position: '2',
      duration: 181880,
    },
  ],
};

const mockMusicBrainzData = {
  artist: 'The Beatles',
  album: 'Abbey Road',
  trackList: [
    {
      title: 'Come Together',
      position: '1',
      duration: 259733,
    },
    {
      title: 'Something',
      position: '2',
      duration: 181880,
    },
  ],
};

describe('RecordService', () => {
  let service: RecordService;
  let model: Model<Record>;
  let cacheManager: any;

  beforeEach(async () => {
    // Create mock implementations
    const modelMock = {
      create: jest.fn().mockResolvedValue(mockRecord),
      findById: jest.fn().mockResolvedValue(mockRecord),
      findByIdAndUpdate: jest.fn().mockResolvedValue(mockRecord),
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockRecord),
        }),
      }),
      findByIdAndDelete: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([mockRecord]),
            }),
          }),
        }),
      }),
      countDocuments: jest.fn().mockResolvedValue(1),
      collection: {
        indexExists: jest.fn().mockResolvedValue(true),
        createIndex: jest.fn().mockResolvedValue({}),
      },
    };

    const cacheManagerMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(null),
      reset: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordService,
        {
          provide: getModelToken('Record'),
          useValue: modelMock,
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManagerMock,
        },
      ],
    }).compile();

    service = module.get<RecordService>(RecordService);
    model = module.get<Model<Record>>(getModelToken('Record'));
    cacheManager = module.get(CACHE_MANAGER);

    // Mock the fetchMusicBrainzData method
    jest.spyOn(service as any, 'fetchMusicBrainzData').mockResolvedValue(mockMusicBrainzData);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a record without MBID', async () => {
      const createRecordDto: CreateRecordRequestDTO = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      const result = await service.create(createRecordDto);
      
      expect(model.create).toHaveBeenCalledWith(createRecordDto);
      expect(result).toEqual(mockRecord);
    });

    it('should create a record with MBID and fetch MusicBrainz data', async () => {
      const createRecordDto: CreateRecordRequestDTO = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
        mbid: 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d',
      };

      const result = await service.create(createRecordDto);
      
      // Check that MusicBrainz data was fetched
      expect((service as any).fetchMusicBrainzData).toHaveBeenCalledWith('b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
      
      // Check that the DTO was merged with MusicBrainz data
      expect(model.create).toHaveBeenCalledWith({
        ...createRecordDto,
        trackList: mockMusicBrainzData.trackList,
      });
      
      expect(result).toEqual(mockRecord);
    });

    it('should handle error when fetching MusicBrainz data', async () => {
      // Make the fetchMusicBrainzData method fail
      (service as any).fetchMusicBrainzData.mockRejectedValueOnce(new Error('API Error'));

      const createRecordDto: CreateRecordRequestDTO = {
        artist: 'The Beatles',
        album: 'Abbey Road',
        price: 25,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
        mbid: 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d',
      };

      // It should still create the record even if MusicBrainz fetch fails
      const result = await service.create(createRecordDto);
      
      expect(model.create).toHaveBeenCalledWith(createRecordDto);
      expect(result).toEqual(mockRecord);
    });
  });

  describe('update', () => {
    it('should update a record with MBID and fetch MusicBrainz data', async () => {
      const updateRecordDto = {
        mbid: 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d',
      };

      const result = await service.update('someId', updateRecordDto);
      
      // Check that MusicBrainz data was fetched
      expect((service as any).fetchMusicBrainzData).toHaveBeenCalledWith('b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
      
      // Check that the cache was invalidated
      expect(cacheManager.del).toHaveBeenCalledWith('record:someId');
      expect(cacheManager.reset).toHaveBeenCalled();
      
      // The update should include the MusicBrainz data
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'someId',
        {
          ...updateRecordDto,
          trackList: mockMusicBrainzData.trackList,
          lastModified: expect.any(Date),
        },
        { new: true }
      );
      
      expect(result).toEqual(mockRecord);
    });
  });

  describe('findByMBID', () => {
    it('should find a record by MBID', async () => {
      const result = await service.findByMBID('b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
      
      expect(model.findOne).toHaveBeenCalledWith({ mbid: 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d' });
      expect(result).toEqual(mockRecord);
    });

    it('should return from cache if available', async () => {
      // Mock cache hit
      cacheManager.get.mockResolvedValueOnce(mockRecord);
      
      const result = await service.findByMBID('b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
      
      // Should not query the database
      expect(model.findOne).not.toHaveBeenCalled();
      expect(result).toEqual(mockRecord);
    });
  });

  describe('fetchMusicBrainzDataPublic', () => {
    it('should call the private fetchMusicBrainzData method', async () => {
      const result = await service.fetchMusicBrainzDataPublic('b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
      
      expect((service as any).fetchMusicBrainzData).toHaveBeenCalledWith('b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
      expect(result).toEqual(mockMusicBrainzData);
    });
  });
}); 