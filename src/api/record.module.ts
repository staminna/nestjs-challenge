import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';
import { RecordController } from './controllers/record.controller';
import { RecordService } from './services/record.service';
import { RecordSchema } from './schemas/record.schema';
import { RecordSeeder } from './seed';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Record', schema: RecordSchema }]),
    CacheModule.register({
      ttl: 60 * 5, // 5 minutes
      max: 100, // maximum number of items in cache
    }),
    HttpModule,
  ],
  controllers: [RecordController],
  providers: [RecordService, RecordSeeder],
  exports: [RecordService],
})
export class RecordModule {}
