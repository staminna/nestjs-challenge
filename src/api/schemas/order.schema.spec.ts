import { Order, OrderSchema } from './order.schema';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as mongoose from 'mongoose';

describe('Order Schema', () => {
  let model: Model<Order>;
  let mongoMemoryServer: MongoMemoryServer;
  let mongoUri: string;

  beforeAll(async () => {
    mongoMemoryServer = await MongoMemoryServer.create();
    mongoUri = mongoMemoryServer.getUri();
    await mongoose.connect(mongoUri);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([{ name: 'Order', schema: OrderSchema }]),
      ],
    }).compile();

    model = module.get<Model<Order>>(getModelToken('Order'));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoMemoryServer.stop();
  });

  it('should create a valid order', () => {
    const order = new model({
      recordId: new mongoose.Types.ObjectId(),
      quantity: 2,
    });

    expect(order).toBeDefined();
    expect(order.recordId).toBeDefined();
    expect(order.quantity).toBe(2);
    expect(order.created).toBeDefined();
  });

  it('should not create an order with invalid data', async () => {
    // Test without recordId
    const invalidOrder1 = new model({
      quantity: 2,
    });
    
    await expect(invalidOrder1.validate()).rejects.toThrow();

    // Test with invalid quantity (zero)
    const invalidOrder2 = new model({
      recordId: new mongoose.Types.ObjectId(),
      quantity: 0,
    });
    
    await expect(invalidOrder2.validate()).rejects.toThrow();
  });
}); 