import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class PostgresService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(private configService: ConfigService) {
    this.pool = new Pool({
      host: this.configService.get<string>('PG_HOST'),
      port: this.configService.get<number>('PG_PORT'),
      user: this.configService.get<string>('PG_USER'),
      password: this.configService.get<string>('PG_PASSWORD'),
      database: this.configService.get<string>('PG_DATABASE'),
    });
  }

  async onModuleInit() {
    try {
      await this.pool.query('SELECT NOW()');
      console.log('✅ Connected to Local PostgreSQL (bi_metadata)');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ PostgreSQL connection failed:', message);
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  // Helper method to run queries
  async query(text: string, params?: any[]) {
    return this.pool.query(text, params);
  }
}