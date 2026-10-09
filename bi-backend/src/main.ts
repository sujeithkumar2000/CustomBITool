import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for React frontend
  app.enableCors();

  await app.listen(process.env.PORT || 3000);
  console.log(`🚀 NestJS Backend API running on http://localhost:${process.env.PORT || 3000}`);
}
bootstrap();