import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from './order.controller';
import { OrderService } from '../services/order.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as mongoose from 'mongoose';
import { Order } from '../schemas/order.schema';

describe('OrderController', () => {
  let controller: OrderController;
  let orderService: OrderService;

  const mockRecordId = new mongoose.Types.ObjectId().toString();
  const mockOrderId = new mongoose.Types.ObjectId().toString();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: OrderService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OrderController>(OrderController);
    orderService = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an order successfully', async () => {
      // Arrange
      const createOrderDto = {
        recordId: mockRecordId,
        quantity: 2,
      };

      const mockOrder = {
        _id: mockOrderId,
        recordId: mockRecordId,
        quantity: 2,
        created: new Date(),
      } as Order;

      jest.spyOn(orderService, 'create').mockResolvedValue(mockOrder);

      // Act
      const result = await controller.create(createOrderDto);

      // Assert
      expect(orderService.create).toHaveBeenCalledWith(createOrderDto);
      expect(result).toEqual(mockOrder);
    });

    it('should handle NotFoundException', async () => {
      // Arrange
      const createOrderDto = {
        recordId: mockRecordId,
        quantity: 2,
      };

      jest
        .spyOn(orderService, 'create')
        .mockRejectedValue(new NotFoundException('Record not found'));

      // Act & Assert
      await expect(controller.create(createOrderDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle insufficient stock error', async () => {
      // Arrange
      const createOrderDto = {
        recordId: mockRecordId,
        quantity: 2,
      };

      jest
        .spyOn(orderService, 'create')
        .mockRejectedValue(new Error('Not enough records in stock'));

      // Act & Assert
      await expect(controller.create(createOrderDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all orders', async () => {
      // Arrange
      const mockOrders = [
        {
          _id: mockOrderId,
          recordId: mockRecordId,
          quantity: 2,
          created: new Date(),
        } as Order,
        {
          _id: new mongoose.Types.ObjectId().toString(),
          recordId: mockRecordId,
          quantity: 3,
          created: new Date(),
        } as Order,
      ];

      jest.spyOn(orderService, 'findAll').mockResolvedValue(mockOrders);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(orderService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockOrders);
    });
  });

  describe('findOne', () => {
    it('should return an order by id', async () => {
      // Arrange
      const mockOrder = {
        _id: mockOrderId,
        recordId: mockRecordId,
        quantity: 2,
        created: new Date(),
      } as Order;

      jest.spyOn(orderService, 'findOne').mockResolvedValue(mockOrder);

      // Act
      const result = await controller.findOne(mockOrderId);

      // Assert
      expect(orderService.findOne).toHaveBeenCalledWith(mockOrderId);
      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException if order is not found', async () => {
      // Arrange
      jest.spyOn(orderService, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(controller.findOne(mockOrderId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
