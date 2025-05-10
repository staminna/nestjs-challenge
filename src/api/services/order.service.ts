import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from '../schemas/order.schema';
import { Record } from '../schemas/record.schema';
import { CreateOrderRequestDTO } from '../dtos/create-order.request.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel('Order') private readonly orderModel: Model<Order>,
    @InjectModel('Record') private readonly recordModel: Model<Record>,
  ) {}

  async create(createOrderDto: CreateOrderRequestDTO): Promise<Order> {
    // Check if the record exists and has enough stock
    const record = await this.recordModel.findById(createOrderDto.recordId);

    if (!record) {
      throw new NotFoundException('Record not found');
    }

    if (record.qty < createOrderDto.quantity) {
      throw new Error('Not enough records in stock');
    }

    // Create the order
    const createdOrder = await this.orderModel.create(createOrderDto);

    // Update the record's stock
    await this.recordModel.findByIdAndUpdate(createOrderDto.recordId, {
      $inc: { qty: -createOrderDto.quantity },
    });

    return createdOrder;
  }

  async findAll(): Promise<Order[]> {
    return this.orderModel.find().exec();
  }

  async findOne(id: string): Promise<Order> {
    return this.orderModel.findById(id).exec();
  }
}
