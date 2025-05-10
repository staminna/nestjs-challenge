import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import * as mongoose from 'mongoose';

describe('OrderService', () => {
  let service: OrderService;
  let orderModel: Model<any>;
  let recordModel: Model<any>;

  const mockRecordId = new mongoose.Types.ObjectId().toString();
  const mockOrderId = new mongoose.Types.ObjectId().toString();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getModelToken('Order'),
          useValue: {
            create: jest.fn(),
            find: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            exec: jest.fn(),
          },
        },
        {
          provide: getModelToken('Record'),
          useValue: {
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            lean: jest.fn(),
            exec: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orderModel = module.get<Model<any>>(getModelToken('Order'));
    recordModel = module.get<Model<any>>(getModelToken('Record'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an order successfully', async () => {
      // Arrange
      const createOrderDto = {
        recordId: mockRecordId,
        quantity: 2,
      };

      const record = {
        _id: mockRecordId,
        artist: 'Test Artist',
        album: 'Test Album',
        qty: 10,
      };

      const order = {
        _id: mockOrderId,
        recordId: mockRecordId,
        quantity: 2,
      };

      recordModel.findById = jest.fn().mockResolvedValue(record);
      recordModel.findByIdAndUpdate = jest.fn().mockResolvedValue({
        ...record,
        qty: record.qty - createOrderDto.quantity,
      });

      orderModel.create = jest.fn().mockResolvedValue(order);

      // Act
      const result = await service.create(createOrderDto);

      // Assert
      expect(recordModel.findById).toHaveBeenCalledWith(mockRecordId);
      expect(recordModel.findByIdAndUpdate).toHaveBeenCalledWith(mockRecordId, {
        $inc: { qty: -createOrderDto.quantity },
      });
      expect(orderModel.create).toHaveBeenCalledWith(createOrderDto);
      expect(result).toEqual({
        _id: mockOrderId,
        recordId: mockRecordId,
        quantity: 2,
      });
    });

    it('should throw NotFoundException when record does not exist', async () => {
      // Arrange
      const createOrderDto = {
        recordId: mockRecordId,
        quantity: 2,
      };

      recordModel.findById = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(createOrderDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw Error when record has insufficient stock', async () => {
      // Arrange
      const createOrderDto = {
        recordId: mockRecordId,
        quantity: 10,
      };

      const record = {
        _id: mockRecordId,
        artist: 'Test Artist',
        album: 'Test Album',
        qty: 5, // Less than requested quantity
      };

      recordModel.findById = jest.fn().mockResolvedValue(record);

      // Act & Assert
      await expect(service.create(createOrderDto)).rejects.toThrow(
        'Not enough records in stock',
      );
    });
  });

  describe('findAll', () => {
    it('should return all orders', async () => {
      // Arrange
      const orders = [
        { _id: mockOrderId, recordId: mockRecordId, quantity: 2 },
        {
          _id: new mongoose.Types.ObjectId().toString(),
          recordId: mockRecordId,
          quantity: 3,
        },
      ];

      const findMock = {
        exec: jest.fn().mockResolvedValue(orders),
      };
      orderModel.find = jest.fn().mockReturnValue(findMock);

      // Act
      const result = await service.findAll();

      // Assert
      expect(orderModel.find).toHaveBeenCalled();
      expect(findMock.exec).toHaveBeenCalled();
      expect(result).toEqual(orders);
    });
  });

  describe('findOne', () => {
    it('should return an order by id', async () => {
      // Arrange
      const order = { _id: mockOrderId, recordId: mockRecordId, quantity: 2 };
      const findByIdMock = {
        exec: jest.fn().mockResolvedValue(order),
      };
      orderModel.findById = jest.fn().mockReturnValue(findByIdMock);

      // Act
      const result = await service.findOne(mockOrderId);

      // Assert
      expect(orderModel.findById).toHaveBeenCalledWith(mockOrderId);
      expect(findByIdMock.exec).toHaveBeenCalled();
      expect(result).toEqual(order);
    });

    it('should return null if order is not found', async () => {
      // Arrange
      const findByIdMock = {
        exec: jest.fn().mockResolvedValue(null),
      };
      orderModel.findById = jest.fn().mockReturnValue(findByIdMock);

      // Act
      const result = await service.findOne(mockOrderId);

      // Assert
      expect(orderModel.findById).toHaveBeenCalledWith(mockOrderId);
      expect(findByIdMock.exec).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});
