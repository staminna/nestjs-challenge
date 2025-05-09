import { Test, TestingModule } from '@nestjs/testing';
import { RecordService } from './record.service';
import { getModelToken } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Record } from '../schemas/record.schema';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';
import { Model } from 'mongoose';
import * as xml2js from 'xml2js';

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

const mockMusicBrainzXml = `
<metadata>
  <release id="b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d">
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
        <track>
          <position>2</position>
          <recording>
            <title>Something</title>
          </recording>
          <length>181880</length>
        </track>
      </track-list>
    </media>
  </release>
</metadata>
`;

describe('RecordService', () => {
  let service: RecordService;
  let model: Model<Record>;
  let cacheManager: any;

  beforeEach(async () => {
    // Create mock implementations
    const modelMock = {
      create: jest.fn().mockResolvedValue(mockRecord),
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockRecord),
        }),
      }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(mockRecord),
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockRecord),
        }),
      }),
      findByIdAndDelete: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      }),
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([mockRecord]),
            }),
          }),
        }),
      }),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      }),
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
    
    // Mock fetch for direct testing of the private method
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(mockMusicBrainzXml),
    } as any);
    
    // Mock the delay method to avoid waiting
    jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
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

  describe('findOne', () => {
    it('should find a record by ID', async () => {
      const result = await service.findOne('someId');
      
      expect(model.findById).toHaveBeenCalledWith('someId');
      expect(result).toEqual(mockRecord);
    });
    
    it('should return from cache if available', async () => {
      // Mock cache hit
      cacheManager.get.mockResolvedValueOnce(mockRecord);
      
      const result = await service.findOne('someId');
      
      // Should check cache first
      expect(cacheManager.get).toHaveBeenCalledWith('record:someId');
      // Should not query the database if cache hit
      expect(model.findById).not.toHaveBeenCalled();
      expect(result).toEqual(mockRecord);
    });
    
    it('should cache the result if not in cache', async () => {
      const result = await service.findOne('someId');
      
      expect(cacheManager.set).toHaveBeenCalledWith(
        'record:someId',
        mockRecord,
        expect.any(Number)
      );
      expect(result).toEqual(mockRecord);
    });
  });
  
  describe('findAll', () => {
    it('should find all records with default pagination', async () => {
      const result = await service.findAll(undefined, undefined, undefined, undefined, undefined, 1, 20);
      
      expect(model.find).toHaveBeenCalledWith({}, {});
      expect(model.countDocuments).toHaveBeenCalledWith({});
      expect(result).toEqual({
        records: [mockRecord],
        total: 1,
        page: 1,
        totalPages: 1,
      });
    });
    
    it('should apply search query filter', async () => {
      const expectedQuery = {
        $or: [
          { artist: { $regex: 'Beatles', $options: 'i' } },
          { album: { $regex: 'Beatles', $options: 'i' } },
          { category: { $regex: 'Beatles', $options: 'i' } },
        ]
      };

      await service.findAll('Beatles');
      
      expect(model.find).toHaveBeenCalledWith(expectedQuery, {});
      expect(model.countDocuments).toHaveBeenCalledWith(expectedQuery);
    });
    
    it('should apply multiple filters', async () => {
      const expectedQuery = {
        artist: { $regex: 'Beatles', $options: 'i' },
        album: { $regex: 'Abbey Road', $options: 'i' },
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      };

      await service.findAll(
        undefined,                  // q
        'Beatles',                  // artist
        'Abbey Road',               // album
        RecordFormat.VINYL,         // format
        RecordCategory.ROCK,        // category
        2,                          // page
        10                          // limit
      );
      
      expect(model.find).toHaveBeenCalledWith(expectedQuery, {});
      expect(model.countDocuments).toHaveBeenCalledWith(expectedQuery);
    });
    
    it('should use projection when fields are specified', async () => {
      await service.findAll(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1,
        20,
        'artist,album,price'
      );
      
      // The find method should be called with the second argument as the projection
      expect(model.find).toHaveBeenCalledWith({}, { artist: 1, album: 1, price: 1 });
    });
    
    it('should return from cache if available', async () => {
      const cachedResult = {
        records: [mockRecord],
        total: 1,
        page: 1,
        totalPages: 1,
      };
      
      // Mock cache hit
      cacheManager.get.mockResolvedValueOnce(cachedResult);
      
      const result = await service.findAll('Beatles');
      
      // Should not query the database
      expect(model.find).not.toHaveBeenCalled();
      expect(result).toEqual(cachedResult);
    });
    
    it('should create text index if it does not exist', async () => {
      // Mock index not existing
      model.collection.indexExists = jest.fn().mockResolvedValue(false);
      
      await service.findAll();
      
      expect(model.collection.indexExists).toHaveBeenCalledWith('textIndex');
      expect(model.collection.createIndex).toHaveBeenCalledWith(
        { artist: 'text', album: 'text', category: 'text' },
        { name: 'textIndex' }
      );
    });
    
    it('should handle index creation error', async () => {
      // Mock index check throwing error
      model.collection.indexExists = jest.fn().mockImplementation(() => {
        throw new Error('DB error');
      });
      
      await service.findAll();
      
      // Should still return results despite index error
      expect(model.find).toHaveBeenCalled();
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
  
  describe('delete', () => {
    it('should delete a record and invalidate cache', async () => {
      await service.delete('someId');
      
      expect(model.findByIdAndDelete).toHaveBeenCalledWith('someId');
      expect(cacheManager.del).toHaveBeenCalledWith('record:someId');
      expect(cacheManager.reset).toHaveBeenCalled();
    });
  });

  describe('fetchMusicBrainzDataPublic', () => {
    it('should call the private fetchMusicBrainzData method', async () => {
      const result = await service.fetchMusicBrainzDataPublic('b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
      
      expect((service as any).fetchMusicBrainzData).toHaveBeenCalledWith('b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
      expect(result).toEqual(mockMusicBrainzData);
    });
  });
  
  describe('private methods', () => {
    it('should parse XML data correctly', async () => {
      // Access the private method using type assertion
      const parseXmlMethod = service['parseXmlAndExtractData'].bind(service);
      
      // Create a parser
      const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
      
      // Call the method directly
      const result = await parseXmlMethod(parser, mockMusicBrainzXml);
      
      // Verify the result
      expect(result).toEqual({
        artist: 'The Beatles',
        album: 'Abbey Road',
        trackList: [
          { title: 'Come Together', position: '1', duration: 259733 },
          { title: 'Something', position: '2', duration: 181880 },
        ],
      });
    });
    
    it('should handle XML parsing errors', async () => {
      // Access the private method using type assertion
      const parseXmlMethod = service['parseXmlAndExtractData'].bind(service);
      
      // Create a parser
      const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
      
      // Call the method with invalid XML
      const result = await parseXmlMethod(parser, '<invalid>xml</notclosed>');
      
      // Should return null on error
      expect(result).toBeNull();
    });
    
    it('should handle missing data in XML', async () => {
      // Access the private method using type assertion
      const parseXmlMethod = service['parseXmlAndExtractData'].bind(service);
      
      // Create a parser
      const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
      
      // Call the method with minimal XML that has a release but no data
      const result = await parseXmlMethod(parser, `
        <metadata>
          <release>
            <title></title>
            <artist-credit>
              <name-credit>
                <artist>
                  <name></name>
                </artist>
              </name-credit>
            </artist-credit>
            <media>
              <track-list></track-list>
            </media>
          </release>
        </metadata>
      `);
      
      // Should handle missing data gracefully
      expect(result).toEqual({
        trackList: [],
      });
    });
    
    it('should directly call the private fetchMusicBrainzData method', async () => {
      // Override the mock to test the actual method
      (service as any).fetchMusicBrainzData.mockRestore();
      
      // Mock cache miss and response
      cacheManager.get.mockResolvedValueOnce(null);
      
      // Call the fetch method directly through the public wrapper
      const result = await service.fetchMusicBrainzDataPublic('someMbid');
      
      // Should call fetch with the correct URL
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('someMbid'),
        expect.any(Object)
      );
      
      // Should set the proper headers
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
            'Accept': 'application/xml',
          }),
        })
      );
      
      // Should return the parsed data
      expect(result).toHaveProperty('trackList');
    });
    
    it('should handle fetch errors', async () => {
      // Override the mock to test the actual method
      (service as any).fetchMusicBrainzData.mockRestore();
      
      // Mock fetch failure
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as any);
      
      // Call the fetch method directly through the public wrapper
      const result = await service.fetchMusicBrainzDataPublic('invalidMbid');
      
      // Should return null when fetch fails
      expect(result).toBeNull();
    });
  });
}); 