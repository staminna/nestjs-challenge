import { Test, TestingModule } from '@nestjs/testing';
import { RecordController } from './controllers/record.controller';
import { RecordService } from './services/record.service';
import { getModelToken } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Record } from './schemas/record.schema';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';

describe('RecordModule', () => {
  let module: TestingModule;

  const mockModel = {
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
  };

  const mockCacheManager = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CacheModule.register(), HttpModule],
      providers: [
        RecordService,
        {
          provide: getModelToken(Record.name),
          useValue: mockModel,
        },
        // RecordSeeder,
      ],
      controllers: [RecordController],
    })
      .overrideProvider(CACHE_MANAGER)
      .useValue(mockCacheManager)
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide RecordController', () => {
    const controller = module.get<RecordController>(RecordController);
    expect(controller).toBeDefined();
  });

  it('should provide RecordService', () => {
    const service = module.get<RecordService>(RecordService);
    expect(service).toBeDefined();
  });

  it('should provide CACHE_MANAGER', () => {
    const cacheManager = module.get(CACHE_MANAGER);
    expect(cacheManager).toBeDefined();
    expect(typeof cacheManager.get).toBe('function');
    expect(typeof cacheManager.set).toBe('function');
    expect(typeof cacheManager.del).toBe('function');
  });
});
