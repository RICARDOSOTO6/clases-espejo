import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MetricasController } from './metricas.controller';
import { MetricasService } from './metricas.service';

@Module({
  imports: [AuthModule],
  controllers: [MetricasController],
  providers: [MetricasService],
  exports: [MetricasService],
})
export class MetricasModule {}
