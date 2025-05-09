import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecordModule } from './api/record.module';
import { OrderModule } from './api/order.module';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { AppConfig, appConfig } from './app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 60, // cache expiration in seconds (1 minute)
      max: 100, // maximum number of items in cache
    }),
    MongooseModule.forRoot(AppConfig.mongoUrl, {
      // Connection pool size optimization
      maxPoolSize: 10,
    }),
    RecordModule,
    OrderModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
