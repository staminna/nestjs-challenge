import { Test, TestingModule } from '@nestjs/testing';
import { RecordController } from './record.controller';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Record } from '../schemas/record.schema';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';
import { RecordService } from '../services/record.service';
import { NotFoundException } from '@nestjs/common';

describe('RecordController', () => {
  let recordController: RecordController;
  let recordModel: Model<Record>;
  let service: RecordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecordController],
      providers: [
        {
          provide: getModelToken('Record'),
          useValue: {
            new: jest.fn().mockResolvedValue({}),
            constructor: jest.fn().mockResolvedValue({}),
            find: jest.fn(),
            findById: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: RecordService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({
              records: [
                { _id: '1', name: 'Record 1', price: 100, qty: 10 },
                { _id: '2', name: 'Record 2', price: 200, qty: 20 },
              ],
              total: 2,
              page: 1,
              totalPages: 1,
            }),
            findOne: jest.fn().mockResolvedValue({ _id: '1', name: 'Record 1', price: 100, qty: 10 }),
            create: jest.fn().mockResolvedValue({ _id: '1', name: 'Record 1', price: 100, qty: 10 }),
            update: jest.fn().mockResolvedValue({ _id: '1', name: 'Record 1', price: 100, qty: 10 }),
            delete: jest.fn().mockResolvedValue(undefined),
            findByMBID: jest.fn().mockResolvedValue({ _id: '1', name: 'Record 1', price: 100, qty: 10 }),
            fetchMusicBrainzDataPublic: jest.fn().mockResolvedValue({
              artist: 'The Cure',
              album: 'Disintegration',
              trackList: [
                {
                  title: 'Plainsong',
                  position: '1',
                  duration: 312345,
                },
                {
                  title: 'Pictures of You',
                  position: '2',
                  duration: 438543,
                },
              ],
            }),
          },
        },
      ],
    }).compile();

    recordController = module.get<RecordController>(RecordController);
    recordModel = module.get<Model<Record>>(getModelToken('Record'));
    service = module.get<RecordService>(RecordService);
  });

  it('should create a new record', async () => {
    const createRecordDto: CreateRecordRequestDTO = {
      artist: 'Test',
      album: 'Test Record',
      price: 100,
      qty: 10,
      format: RecordFormat.VINYL,
      category: RecordCategory.ALTERNATIVE,
    };

    const savedRecord = {
      _id: '1',
      name: 'Record 1',
      price: 100,
      qty: 10,
    };

    const result = await recordController.create(createRecordDto);
    expect(result).toEqual(savedRecord);
    expect(service.create).toHaveBeenCalledWith(createRecordDto);
  });

  it('should return an array of records', async () => {
    const result = await recordController.findAll();
    expect(result).toEqual({
      records: [
        { _id: '1', name: 'Record 1', price: 100, qty: 10 },
        { _id: '2', name: 'Record 2', price: 200, qty: 20 },
      ],
      total: 2,
      page: 1,
      totalPages: 1,
    });
    expect(service.findAll).toHaveBeenCalled();
  });

  describe('update', () => {
    it('should update a record with MBID', async () => {
      const updateRecordDto = {
        mbid: '11af85e2-c272-4c59-a902-47f75141dc97',
      };

      const result = await recordController.update('1', updateRecordDto);
      
      expect(service.update).toHaveBeenCalledWith('1', updateRecordDto);
      expect(result).toEqual({ _id: '1', name: 'Record 1', price: 100, qty: 10 });
    });

    it('should throw NotFoundException when record not found', async () => {
      service.update = jest.fn().mockResolvedValue(null);
      
      const updateRecordDto = {
        mbid: '11af85e2-c272-4c59-a902-47f75141dc97',
      };

      await expect(recordController.update('nonexistentId', updateRecordDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByMBID', () => {
    it('should find a record by MBID', async () => {
      const result = await recordController.findByMBID('11af85e2-c272-4c59-a902-47f75141dc97');
      
      expect(service.findByMBID).toHaveBeenCalledWith('11af85e2-c272-4c59-a902-47f75141dc97');
      expect(result).toEqual({ _id: '1', name: 'Record 1', price: 100, qty: 10 });
    });

    it('should throw NotFoundException when record not found', async () => {
      service.findByMBID = jest.fn().mockResolvedValue(null);
      
      await expect(recordController.findByMBID('nonexistentId')).rejects.toThrow(NotFoundException);
    });
  });

  describe('fetchMusicBrainzData', () => {
    it('should fetch MusicBrainz data', async () => {
      const result = await recordController.fetchMusicBrainzData('11af85e2-c272-4c59-a902-47f75141dc97');
      
      expect(service.fetchMusicBrainzDataPublic).toHaveBeenCalledWith('11af85e2-c272-4c59-a902-47f75141dc97');
      expect(result).toEqual({
        artist: 'The Cure',
        album: 'Disintegration',
        trackList: [
          {
            title: 'Plainsong',
            position: '1',
            duration: 312345,
          },
          {
            title: 'Pictures of You',
            position: '2',
            duration: 438543,
          },
        ],
      });
    });

    it('should throw NotFoundException when MusicBrainz data not found', async () => {
      service.fetchMusicBrainzDataPublic = jest.fn().mockResolvedValue(null);
      
      await expect(recordController.fetchMusicBrainzData('invalidId')).rejects.toThrow(NotFoundException);
    });
  });
});
