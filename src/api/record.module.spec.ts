import { Test, TestingModule } from '@nestjs/testing';
import { RecordModule } from './record.module';
import { RecordController } from './controllers/record.controller';
import { RecordService } from './services/record.service';
import { getModelToken } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('RecordModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [RecordModule],
    })
      .overrideProvider(getModelToken('Record'))
      .useValue({})
      .overrideProvider(CACHE_MANAGER)
      .useValue({})
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
}); 