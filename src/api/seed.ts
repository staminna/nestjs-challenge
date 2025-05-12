import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Record } from './schemas/record.schema';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RecordSeeder implements OnModuleInit {
  private readonly logger = new Logger(RecordSeeder.name);

  constructor(
    @InjectModel('Record') private readonly recordModel: Model<Record>,
  ) {}

  async onModuleInit() {
    const count = await this.recordModel.countDocuments();
    if (count === 0) {
      try {
        // Check for both _data.json and data.json
        const rootDir = process.cwd();
        let dataPath = path.join(rootDir, 'data.json');

        // If data.json doesn't exist, try _data.json
        if (!fs.existsSync(dataPath)) {
          dataPath = path.join(rootDir, '_data.json');

          // If _data.json exists, create a copy as data.json for future runs
          if (fs.existsSync(dataPath)) {
            this.logger.log(`Found _data.json, using it for seeding`);
            const content = fs.readFileSync(dataPath, 'utf-8');
            fs.writeFileSync(path.join(rootDir, 'data.json'), content);
            dataPath = path.join(rootDir, 'data.json');
          }
        }

        // If neither file exists, create default data for e2e tests
        if (!fs.existsSync(dataPath)) {
          this.logger.warn(`No data files found. Creating minimum test data.`);
          const defaultData = [
            {
              artist: 'Test Artist',
              album: 'Test Album',
              price: 19.99,
              qty: 10,
              format: 'Vinyl',
              category: 'Rock',
              trackList: [
                { position: 'A1', title: 'Test Track 1', duration: 180 },
                { position: 'A2', title: 'Test Track 2', duration: 200 },
              ],
            },
          ];
          fs.writeFileSync(dataPath, JSON.stringify(defaultData, null, 2));
        }

        // Read the data file and seed the database
        const raw = fs.readFileSync(dataPath, 'utf-8');
        const records = JSON.parse(raw);
        const recordsWithFlag = records.map((record) => ({
          ...record,
          isUserCreated: false,
        }));
        await this.recordModel.insertMany(recordsWithFlag);
        this.logger.log(
          `Seeded ${recordsWithFlag.length} records from ${dataPath}`,
        );
      } catch (error) {
        this.logger.error(`Failed to seed data: ${error.message}`, error.stack);
        // Don't throw the error - allow the application to continue
      }
    }
  }
}
