import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, ClickHouseClient } from '@clickhouse/client';

@Injectable()
export class ClickhouseService implements OnModuleInit {
  private client: ClickHouseClient;

  constructor(private configService: ConfigService) {
    this.client = createClient({
      url: this.configService.get<string>('CLICKHOUSE_HOST'),
      username: this.configService.get<string>('CLICKHOUSE_USER'),
      password: this.configService.get<string>('CLICKHOUSE_PASSWORD'),
      database: this.configService.get<string>('CLICKHOUSE_DB'),
      request_timeout: 30000,
    });
  }

  async onModuleInit() {
    try {
      const ping = await this.client.ping();
      if (ping.success) {
        console.log('✅ Connected to ClickHouse Cloud (bi_analytics)');
      }
    } catch (error) {
      console.error(
        '❌ ClickHouse connection failed:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Helper method to execute analytics queries
  async query(queryText: string) {
    const resultSet = await this.client.query({
      query: queryText,
      format: 'JSONEachRow',
    });
    return resultSet.json();
  }
}