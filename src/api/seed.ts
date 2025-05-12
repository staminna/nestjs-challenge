import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Record } from './schemas/record.schema';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RecordSeeder implements OnModuleInit {
  constructor(
    @InjectModel('Record') private readonly recordModel: Model<Record>,
  ) {}

  async onModuleInit() {
    const count = await this.recordModel.countDocuments();
    if (count === 0) {
      const dataPath = path.join(__dirname, '../../data.json');
      const raw = fs.readFileSync(dataPath, 'utf-8');
      const records = JSON.parse(raw);
      const recordsWithFlag = records.map((record) => ({
        ...record,
        isUserCreated: false,
      }));
      await this.recordModel.insertMany(recordsWithFlag);
      console.log('Seeded records from data.json');
    }
  }
}
