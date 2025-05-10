import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Order extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Record', required: true })
  recordId: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ default: Date.now })
  created: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
