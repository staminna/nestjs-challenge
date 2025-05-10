import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { RecordFormat, RecordCategory } from './record.enum';

// Track schema for nested track list
@Schema({ _id: false })
export class Track {
  @Prop({ required: true })
  title: string;

  @Prop()
  position: string;

  @Prop()
  duration: number;
}

@Schema({ timestamps: true })
export class Record extends Document {
  @Prop({ required: true })
  artist: string;

  @Prop({ required: true })
  album: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  qty: number;

  @Prop({ enum: RecordFormat, required: true })
  format: RecordFormat;

  @Prop({ enum: RecordCategory, required: true })
  category: RecordCategory;

  @Prop({ default: Date.now })
  created: Date;

  @Prop({ default: Date.now })
  lastModified: Date;

  @Prop({ required: false })
  mbid?: string;

  @Prop({
    type: [{ title: String, position: String, duration: Number }],
    default: [],
  })
  trackList: Track[];
}

export const RecordSchema = SchemaFactory.createForClass(Record);

// Create indexes for better search performance
RecordSchema.index({ artist: 'text', album: 'text', category: 'text' });
// Add regular indexes for common query fields
RecordSchema.index({ artist: 1 });
RecordSchema.index({ album: 1 });
RecordSchema.index({ format: 1 });
RecordSchema.index({ category: 1 });
RecordSchema.index({ mbid: 1 });
