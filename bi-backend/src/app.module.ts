import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PostgresService } from './database/postgres/postgres.service.js';
import { ClickhouseService } from './database/clickhouse/clickhouse.service.js';
import { AnalyticsController } from './analytics/analytics.controller.js';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Loads .env globally across all modules
    }),
  ],
  controllers: [AnalyticsController],
  providers: [PostgresService, ClickhouseService],
  exports: [PostgresService, ClickhouseService],
})
export class AppModule {}